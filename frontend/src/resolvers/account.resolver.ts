import { Injectable } from '@angular/core';
import { Resolve, } from '@angular/router';
import { Observable, catchError, of } from 'rxjs';
import { DataService } from '../services/data.service';
import { AuthService } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class AccountResolver implements Resolve<any | null> {
  constructor(
    private dataService: DataService,
    private authService: AuthService
  ) {}

  resolve(): Observable<any | null> {
    const token = this.authService.tokenValue;
    
    if (!token) {
      return of(null);
    }
    
    return this.dataService.userDS.getUserData(token).pipe(
      catchError(error => {
        return of(null);
      })
    );
  }
}