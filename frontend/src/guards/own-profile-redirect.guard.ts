import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, Router, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
@Injectable({ providedIn: 'root' })
export class OwnProfileRedirectGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}
  canActivate(route: ActivatedRouteSnapshot): Observable<boolean | UrlTree> {
    const username = route.paramMap.get('username');
    if (!username) return of(true);
    const me = this.auth.currentUserValue;
    if (me?.username) {
      return of(me.username === username
        ? this.router.createUrlTree(['/account'])
        : true
      );
    }
    const token = this.auth.tokenValue;
    if (!token) return of(true);
    return this.auth.getUserBySessionId(token).pipe(
      take(1),
      map(user => {
        if (user?.username === username) {
          return this.router.createUrlTree(['/account']);
        }
        return true;
      }),
      catchError(() => of(true))
    );
  }
}
