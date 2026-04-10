import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environment';

@Injectable({
  providedIn: 'root'
})
export class LessonsDataService {
  constructor(private http: HttpClient) {  }

  createClassLesson(session_id: string, link: string, date_and_time: string, homework?: string): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/lessons/create-class-lesson`, { session_id, link, date_and_time, homework });
  }
  getLessons(session_id: string, link: string, week?: string): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/lessons/get`, { session_id, link, week });
  }
}