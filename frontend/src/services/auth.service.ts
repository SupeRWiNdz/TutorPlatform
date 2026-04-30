import { inject, Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { BehaviorSubject, catchError, map, Observable, of, tap } from 'rxjs';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';
import { DataService } from './data.service';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private _snackBar = inject(MatSnackBar);
  openSnackBar(message: string) {
    this._snackBar.open(message, 'Закрыть', {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom'
    });
  }

  private tokenSubject: BehaviorSubject<string | null>;
  public token$: Observable<string | null>;

  private currentUserSubject: BehaviorSubject<any | null>;
  public currentUser$: Observable<any | null>;

  private sessionsSubject = new BehaviorSubject<any | null>(null);
  public sessions$ = this.sessionsSubject.asObservable();

  constructor(
    private dataService: DataService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private router: Router
  ) {
    this.tokenSubject = new BehaviorSubject<string | null>(this.getTokenFromStorage());
    this.token$ = this.tokenSubject.asObservable();

    this.currentUserSubject = new BehaviorSubject<any | null>(null);
    this.currentUser$ = this.currentUserSubject.asObservable();

    this.sessionsSubject = new BehaviorSubject<any | null>(null);
    this.sessions$ = this.sessionsSubject.asObservable();

    this.loadUser();
    this.loadSessions();
  }

  private loadUser(): void {
    const token = this.getTokenFromStorage();
    if (token) {
      this.dataService.userDS.getUserData(token).pipe(
        tap(user => this.currentUserSubject.next(user)),
        catchError(() => {
          this.logout();
          return of(null);
        })
      ).subscribe();
    }
  }
  public loadSessions(): void {
    const token = this.getTokenFromStorage();
    if (token) {
      this.dataService.sessionDS.get(token).pipe(
        tap(response => this.sessionsSubject.next(response)), 
        catchError(() => of(null))
      ).subscribe();
    }
  }
  private getTokenFromStorage(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem('token');
    }
    return null;
  }

  public setTokenToStorage(token: string): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('token', token);
    }
    this.tokenSubject.next(token);
  }
  public getUserBySessionId(sessionId: string): Observable<any | null> {
    return this.dataService.userDS.getUserData(sessionId).pipe(
      tap(user => this.currentUserSubject.next(user)),
      catchError(() => {
        localStorage.removeItem('token');
        this.currentUserSubject.next(null);
        this.tokenSubject.next(null);
        return of(null);
      })
    );
  }

  public logout() {
    const token = this.tokenValue;
    if (token)
      this.dataService.sessionDS.logout(token).subscribe({
        next: (response) => {
          localStorage.removeItem('token');
          this.currentUserSubject.next(null);
          this.tokenSubject.next(null);
          if (response.message)
            this.openSnackBar(response.message);
          this.router.navigate(['/login']);
        },
        error: (error) => {
          if (error.message) this.openSnackBar(error.message);
          localStorage.removeItem('token');
          this.currentUserSubject.next(null);
          this.tokenSubject.next(null);
          this.router.navigate(['/login']);
        }
      });
  }
  public closeAllSessions(): void {
    const token = this.tokenValue;
    if (token) {
      this.dataService.sessionDS.closeAll(token).subscribe({
        next: (response) => {
          if (response.message)
            this.openSnackBar(response.message);
          this.logout();
        },
        error: (error) => {
          if (error.message)
            this.openSnackBar(error.message);
          this.logout();
        }
      });
    }
  }

  closeOtherSessions(): void {
    const token = this.tokenValue;
    if (token) {
      this.dataService.sessionDS.closeOther(token).subscribe({
        next: (response) => {
          this.loadSessions(); // перезагружаем сессии
          if (response.message) this.openSnackBar(response.message);
        },
        error: (error) => {
          if (error.message) this.openSnackBar(error.message);
        }
      });
    }
  }

  public get currentUserValue(): any | null {
    return this.currentUserSubject.value;
  }
  public get tokenValue(): string | null {
    return this.tokenSubject.value;
  }
  public checkActiveSession(): Observable<boolean> {
    const token = this.tokenValue;
    if (!token) {
      return of(false);
    }

    return this.dataService.sessionDS.checkActive(token).pipe(
      map((isValid: boolean) => {
        if (!isValid)
          this.logout();
        return isValid;
      }),
      catchError((error: any) => {
        this.logout();
        return of(false);
      })
    );
  }
  public loadUserData(): void {
    const token = this.getTokenFromStorage();
    if (token) {
      this.dataService.userDS.getUserData(token).pipe(
        tap(user => {
          this.currentUserSubject.next(user);
        }),
        catchError(error => {
          return of(null);
        })
      ).subscribe();
    }
  }
}