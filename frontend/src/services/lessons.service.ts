import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { BehaviorSubject, catchError, Observable, of, tap } from 'rxjs';
import { DataService } from './data.service';
import { AuthService } from './auth.service';
import { FormGroup } from '@angular/forms';

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
    private auth: AuthService
  ) {
    this.lessonsSubject = new BehaviorSubject<any | null>(null);
    this.lessons$ = this.lessonsSubject.asObservable();
  }

  getDaysArray(lessons: any): Array<{ key: string, label: string, date: string, is_today: boolean, lessons: any[] }> {
    if (!lessons || !lessons.lessons) return [];

    return this.daysOrder
      .filter(key => lessons.lessons[key])
      .map(key => ({
        key: key,
        label: lessons.lessons[key].label,
        is_today: lessons.lessons[key].is_today,
        date: lessons.lessons[key].date,
        lessons: lessons.lessons[key].lessons || []
      }));
  }
  getStudents(lessons: any): Array<{ username: string, full_name: string }> {
    return lessons?.students || [];
  }


  public setInitialState(response: any, link?: string): void {
    this.clearState();
    if (link) this.currentClassLink = link;
    this.lessonsSubject.next(response);
  }

  public clearState(): void {
    this.lessonsSubject.next(null);
    this.weekNumber = 0;
    this.currentClassLink = null;
  }

  public reloadWeek(): Observable<any> { return this.changeWeek(0); }
  public nextWeek(): Observable<any> { return this.changeWeek(1); }
  public previousWeek(): Observable<any> { return this.changeWeek(-1); }

  private changeWeek(delta: number): Observable<any> {
    const sessionId = this.auth.tokenValue;
    if (!sessionId) return of(null);

    const targetWeek = this.weekNumber + delta;

    const request$ = this.currentClassLink
      ? this.dataService.lessonsDS.get(sessionId, this.currentClassLink, String(targetWeek))
      : this.dataService.lessonsDS.getPersonal(sessionId, String(targetWeek));

    return request$.pipe(
      tap(response => {
        this.weekNumber = targetWeek;
        this.lessonsSubject.next(response);
      }),
      catchError(() => of(null))
    );
  }


  private create(link: string, date: string, time: string, homework?: string, duration?: string): Observable<any> {
    const sessionId = this.auth.tokenValue;
    if (!sessionId) return of(null);
    return this.dataService.lessonsDS.create(sessionId, link, date, time, homework, duration);
  }
  private edit(lesson_id: string, date?: string, time?: string, homework?: string, duration?: string): Observable<any> {
    const sessionId = this.auth.tokenValue;
    if (!sessionId) return of(null);
    return this.dataService.lessonsDS.edit(sessionId, lesson_id, date, time, homework, duration);
  }
  public remove(lesson_id: string): Observable<any> {
    const sessionId = this.auth.tokenValue;
    if (!sessionId) return of(null);
    return this.dataService.lessonsDS.remove(sessionId, lesson_id);
  }

  public submitForm(formValue: FormGroup, link: string | null = null, lessonID: string | null = null, mode: string | null = null): Observable<any> {
    const { date, time, duration, homework } = formValue.value;
    if (mode == 'create' && link) { return this.create(link, date, time, homework, duration); }
    else if (mode == 'edit' && lessonID) { return this.edit(lessonID, date, time, homework, duration); }
    return of(null);
  }
  getEndTime(startTime: string, durationMinutes: number): string {
    if (!startTime || durationMinutes == null) return '';

    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + durationMinutes;
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMinutes = totalMinutes % 60;

    return `${this.pad(endHours)}:${this.pad(endMinutes)}`;
  }

  private pad(num: number): string {
    return num < 10 ? '0' + num : num.toString();
  }
  getStudentLesson(lesson_id: string, username: string): Observable<any> {
  const sessionId = this.auth.tokenValue;
  if (!sessionId) return of(null);
  return this.dataService.lessonsDS.getStudentLesson(sessionId, lesson_id, username);
}
editStudentLesson(lesson_id: string, username: string, homework: string, comment: string): Observable<any> {
  const sessionId = this.auth.tokenValue;
  if (!sessionId) return of(null);
  return this.dataService.lessonsDS.editStudentLesson(sessionId, lesson_id, username, homework, comment);
}
}