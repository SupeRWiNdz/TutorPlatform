import { Injectable } from '@angular/core';
import { Resolve, ActivatedRouteSnapshot, Router } from '@angular/router';
import { DataService } from './data.service';
import { Title } from '@angular/platform-browser';
import { Observable, catchError, map, tap, of, EMPTY } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ProfileResolver implements Resolve<any | null> {
  constructor(
    private dataService: DataService,
    private titleService: Title,
  ) {}

  resolve(route: ActivatedRouteSnapshot): Observable<any | null> {
    const username = route.paramMap.get('username');
    
    if (!username) {
      return of(null);
    }
    
    return this.dataService.getProfile(username).pipe(
      tap((user: any) => {
        if (user && user.username) {
          const pageTitle = user.full_name || user.username;
          this.titleService.setTitle(`${pageTitle}`);
        }
      }),
      catchError(error => {
        this.titleService.setTitle('Профиль не найден');
        return of(null);
      })
    );
  }
}