import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environment';

@Injectable({
  providedIn: 'root'
})
export class ClassDataService {
  private apiUrl = environment.apiUrl;
  constructor(private http: HttpClient) {  }

  getClasses(session_id: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/class/list`, { session_id });
  }
  getClass(sessionId: string, link: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/class/info/${link}`, { session_id: sessionId });
  }
}