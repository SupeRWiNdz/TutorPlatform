import { Injectable } from '@angular/core';
import { Resolve, ActivatedRouteSnapshot, Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Observable, catchError, map, tap, of, EMPTY } from 'rxjs';
import { DataService } from '../services/data.service';
import { AuthService } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class RequestResolver implements Resolve<any | null> {
  constructor(
    private dataService: DataService,
    private titleService: Title,
    private authService: AuthService
  ) {}

  resolve(route: ActivatedRouteSnapshot): Observable<any | null> {
    const link = route.paramMap.get('link');
    const token = this.authService.tokenValue;
    
    if (!link || !token) {
      return of(null);
    }
    
    return this.dataService.requestDS.check(token,link).pipe(
      tap((response: any) => {
        if (response && response.name) {
          const pageTitle = 'Приглашение: '+response.name;
          this.titleService.setTitle(`${pageTitle}`);
        }
      }),
      catchError(error => {
        this.titleService.setTitle('Приглашение недействительно');
        return of({message:error.error.message});
      })
    );
  }
}