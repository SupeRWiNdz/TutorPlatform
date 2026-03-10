import { Injectable } from '@angular/core';
import { Resolve, ActivatedRouteSnapshot, Router } from '@angular/router';
import { DataService } from './data.service';
import { Title } from '@angular/platform-browser';
import { Observable, catchError, map, tap, of, EMPTY } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class ClassResolver implements Resolve<any | null> {
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
    
    return this.dataService.getClass(token, link).pipe(
      tap((selected_class: any) => {
        if (selected_class && selected_class.name) {
          const pageTitle = selected_class.name;
          this.titleService.setTitle(`${pageTitle}`);
        }
      }),
      catchError(error => {
        this.titleService.setTitle('Класс недоступен');
        return of(null);
      })
    );
  }
}