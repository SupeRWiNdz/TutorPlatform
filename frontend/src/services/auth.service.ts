import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { BehaviorSubject, catchError, map, Observable, of, tap } from 'rxjs';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';
import { DataService } from './data.service';
import { User } from '../models/auth.models';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private tokenSubject: BehaviorSubject<string | null>;
  public token$: Observable<string | null>;
  
  private currentUserSubject: BehaviorSubject<User | null>;
  public currentUser$: Observable<User | null>;

  constructor(
    private dataService: DataService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.tokenSubject = new BehaviorSubject<string | null>(this.getTokenFromStorage());
    this.token$ = this.tokenSubject.asObservable();
    
    this.currentUserSubject = new BehaviorSubject<User | null>(null);
    this.currentUser$ = this.currentUserSubject.asObservable();
    
    this.loadUser();
  }

  private loadUser(): void {
      const token = this.getTokenFromStorage();
      if (token) {
        this.dataService.getUserData(token).pipe(
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
  public getUserBySessionId(sessionId: string): Observable<User | null> {
    return this.dataService.getUserData(sessionId).pipe(
      tap(user => this.currentUserSubject.next(user)),
      catchError(() => {
        this.logout();
        return of(null);
      })
    );
  }
  public logout() {
    const token = this.tokenValue;
    if (token) {
      this.dataService.logout(token).subscribe({
        next: (response) => {
          this.clearLocalData();
        },
        error: (error) => {
          this.clearLocalData();
        }
      });
    } else {
      this.clearLocalData();
    }
  }
  public closeAllSessions() {
    const token = this.tokenValue;
    if (token) {
      this.dataService.closeAllSessions(token).subscribe({
        next: (response) => {
          this.clearLocalData();
        },
        error: (error) => {
          this.clearLocalData();
        }
      });
    } else {
      this.clearLocalData();
    }
  }
  public closeOtherSessions() {
  const token = this.tokenValue;
  if (token) {
    this.dataService.closeOtherSessions(token).subscribe({
      next: (response) => {
      },
      error: (error) => {
      }
    });
  } else {
    this.clearLocalData();
  }
  }
  private clearLocalData(): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('token');
    }
    this.tokenSubject.next(null);
    this.currentUserSubject.next(null);
  }
  public get currentUserValue(): User | null {
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

    return this.dataService.checkActiveSession(token).pipe(
      map((isValid: boolean) => {
        if (!isValid)
          this.clearLocalData();
        return isValid;
      }),
      catchError((error: any) => {
        this.clearLocalData();
        return of(false);
      })
    );
  }
  public loadUserData(): void {
  const token = this.getTokenFromStorage();
  if (token) {
    this.dataService.getUserData(token).pipe(
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