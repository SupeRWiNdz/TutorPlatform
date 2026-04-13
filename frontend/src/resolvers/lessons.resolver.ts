import { Injectable } from '@angular/core';
import { Resolve, ActivatedRouteSnapshot } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { AuthService } from '@services/auth.service';
import { DataService } from '@services/data.service';
import { LessonsService } from '@services/lessons.service';

@Injectable({ providedIn: 'root' })
export class LessonsResolver implements Resolve<any[] > {

  constructor(
    private auth: AuthService,
    private dataService: DataService,
    private lessonsService: LessonsService
  ) {}

  resolve(route: ActivatedRouteSnapshot): Observable<any | null> {
    const link = route.paramMap.get('link');
    const sessionId = this.auth.tokenValue;
    if (!link || !sessionId) return of(null);
    return this.dataService.lessonsDS.get(sessionId, link).pipe(
      tap(resp => this.lessonsService.setInitialState(link, resp)),
      catchError(() => of(null))
    );
  }
}
