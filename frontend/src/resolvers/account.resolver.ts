import { Injectable } from '@angular/core';
import { Resolve, ActivatedRouteSnapshot, Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Observable, catchError, map, tap, of, EMPTY } from 'rxjs';
import { DataService } from '../services/data-service/data.service';
import { AuthService } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class AccountResolver implements Resolve<any | null> {
  constructor(
    private dataService: DataService,
    private authService: AuthService
  ) {}

  resolve(route: ActivatedRouteSnapshot): Observable<any | null> {
    const token = this.authService.tokenValue;
    
    if (!token) {
      return of(null);
    }
    
    return this.dataService.userDS.getUserData(token).pipe(
      tap((user: any) => {
      }),
      catchError(error => {
        return of(null);
      })
    );
  }
}