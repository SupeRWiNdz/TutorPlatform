import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Observable, map, take, of } from 'rxjs';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  canActivate(): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    if (isPlatformServer(this.platformId)) {
      return of(true); 
    }

    return this.authService.checkActiveSession().pipe(
      take(1),
      map(isValid => {
        if (!isValid) {
          return this.router.parseUrl('/login');
        }
        return true;
      })
    );
  }
}