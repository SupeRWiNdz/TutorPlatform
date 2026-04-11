import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { BehaviorSubject, catchError, map, Observable, of, tap } from 'rxjs';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';
import { DataService } from './data.service';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private tokenSubject: BehaviorSubject<string | null>;
  public token$: Observable<string | null>;

  private currentUserSubject: BehaviorSubject<any | null>;
  public currentUser$: Observable<any | null>;

  constructor(
    private dataService: DataService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private router: Router
  ) {
    this.tokenSubject = new BehaviorSubject<string | null>(this.getTokenFromStorage());
    this.token$ = this.tokenSubject.asObservable();

    this.currentUserSubject = new BehaviorSubject<any | null>(null);
    this.currentUser$ = this.currentUserSubject.asObservable();

    this.loadUser();
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
      this.dataService.sessionDS.logout(token);
    localStorage.removeItem('token');
    this.currentUserSubject.next(null);
    this.tokenSubject.next(null);
    this.router.navigate(['/login']);
  }
  public closeAllSessions() {
    const token = this.tokenValue;
    if (token) {
      this.dataService.sessionDS.closeAll(token).subscribe({
        next: (response) => {
          this.logout();
        },
        error: (error) => {
          this.logout();
        }
      });
    } else {
      this.logout();
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