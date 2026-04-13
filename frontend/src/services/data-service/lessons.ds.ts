import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environment';

@Injectable({
  providedIn: 'root'
})
export class LessonsDataService {
  constructor(private http: HttpClient) {  }

  create(session_id: string, link: string, date: string, time: string, homework?: string, duration?: string): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/lessons/create`, { session_id, link, date, time, homework, duration });
  }
  get(session_id: string, link: string, week?: string): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/lessons/get`, { session_id, link, week });
  }
  edit(session_id: string, lesson_id: string, date?: string, time?: string, homework?: string, duration?: string): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/lessons/edit`, { session_id, lesson_id, date, time, homework, duration });
  }
  remove(session_id: string, lesson_id: string): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/lessons/remove`, { session_id, lesson_id });
  }
}