import { Injectable } from '@angular/core';
import { Resolve, ActivatedRouteSnapshot, Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Observable, catchError, map, tap, of, EMPTY } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { DataService } from '../services/data.service';

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
    this.titleService.setTitle('Класс недоступен');
    return of({ message: 'Сессия не найдена или ссылка не указана' });
  }
  
  return this.dataService.classDS.getClass(token, link).pipe(
    tap((response: any) => {
      if (response && response.name) {
        this.titleService.setTitle(response.name);
      }
    }),
    catchError(error => {
      this.titleService.setTitle('Класс недоступен');
      const errorMessage = error?.error?.message || 'Не удалось загрузить класс';
      return of({ message: errorMessage });
    })
  );
}
}