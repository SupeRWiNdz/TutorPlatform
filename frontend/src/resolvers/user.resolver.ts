import { Injectable } from '@angular/core';
import { Resolve } from '@angular/router';
import { Observable, of } from 'rxjs';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class UserResolver implements Resolve<any | null> {
  
  constructor(private authService: AuthService) {}

  resolve(): Observable<any | null> {
    if (this.authService.currentUserValue) {
      return of(this.authService.currentUserValue);
    }
    
    const token = this.authService.tokenValue;
    if (token) {
      return this.authService.getUserBySessionId(token);
    }
    
    return of(null);
  }
}