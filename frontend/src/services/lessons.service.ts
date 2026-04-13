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
  public get isCurrentWeek(): boolean {
    return this.weekNumber == 0;
  }
  private currentClassLink: string | null = null;
  private daysOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  constructor(
    private dataService: DataService,
    private auth: AuthService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.lessonsSubject = new BehaviorSubject<any | null>(null);
    this.lessons$ = this.lessonsSubject.asObservable();
  }

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

  public reloadWeek(): void {
    this.changeWeek(0);
  }
  public nextWeek(): void {
    this.changeWeek(1);
  }
  public previousWeek(): void {
    this.changeWeek(-1);
  }
  private changeWeek(mode: number): void {
    const sessionId = this.auth.tokenValue;
    if (!this.currentClassLink || !sessionId) return;
    this.weekNumber += mode;
    this.dataService.lessonsDS.get(sessionId, this.currentClassLink, this.weekNumber.toString()).pipe(
      tap(resp => this.lessonsSubject.next(resp)),
      catchError(() => of(null))
    ).subscribe();;
  }

  public create(session_id: string, link: string, date: string, time: string, homework?: string, duration?: string): Observable<any> {
    return this.dataService.lessonsDS.create(session_id, link, date, time, homework, duration );
  }
  public edit(session_id: string, lesson_id: string, date?: string, time?: string, homework?: string, duration?: string): Observable<any> {
    return this.dataService.lessonsDS.edit(session_id, lesson_id, date, time, homework, duration );
  }
  public remove(session_id: string, lesson_id: string): Observable<any> {
    return this.dataService.lessonsDS.remove(session_id, lesson_id );
  }
}