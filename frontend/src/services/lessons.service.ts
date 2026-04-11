import { Inject, Injectable, PLATFORM_ID, OnDestroy } from '@angular/core';
import { BehaviorSubject, catchError, Observable, of, Subscription, tap, interval, switchMap, filter } from 'rxjs';
import { DataService } from './data.service';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class LessonsService {

  private lessonsSubject: BehaviorSubject<any[] | null>;
  public lessons$: Observable<any[] | null>;
  private weekNumber: number = 0;
  private currentClassLink: string | null = null;
  private daysOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  constructor(
    private dataService: DataService,
    private authService: AuthService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.lessonsSubject = new BehaviorSubject<any | null>(null);
    this.lessons$ = this.lessonsSubject.asObservable();
  }
  //loadLessons(): void {
  //  const token = this.authService.tokenValue;
  //  if (!token) return;
  //  this.dataService.lessonsDS.getLessons(token, 'physicssmirnov').pipe(
  //    tap(response => this.lessonsSubject.next(response)),
  //    catchError(() => {
  //      return of(null);
  //    })
  //  ).subscribe();
  //}


  getDaysArray(weekData: any): Array<{ key: string, label: string, date: string, is_today: boolean, lessons: any[] }> {
    if (!weekData || !weekData.lessons) return [];

    return this.daysOrder
      .filter(key => weekData.lessons[key])
      .map(key => ({
        key: key,
        label: weekData.lessons[key].label,
        is_today: weekData.lessons[key].is_today,
        date: weekData.lessons[key].date,
        lessons: weekData.lessons[key].lessons || []
      }));
  }


  public setInitialState(link: string, response: any): void {
    this.currentClassLink = link;
    this.lessonsSubject.next(response);
  }


  private resetState(): void {
    this.lessonsSubject.next([]);
  }

}