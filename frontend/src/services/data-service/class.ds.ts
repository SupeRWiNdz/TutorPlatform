import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environment';

@Injectable({
  providedIn: 'root'
})
export class ClassDataService {
  constructor(private http: HttpClient) {  }

  createClass(session_id: string, name: string, link: string, description: string): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/class/new`, { session_id, name, link, description });
  }
  deleteClass(session_id: string, link: string): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/class/delete`, { session_id, link });
  }
  editClass(session_id: string, link: string, new_name: string, new_link: string, new_description: string): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/class/edit`, { session_id, link, new_name, new_link, new_description });
  }
  getClass(sessionId: string, link: string): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/class/info/${link}`, { session_id: sessionId });
  }
  myClasses(session_id: string): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/class/list`, { session_id });
  }
  deleteMember(session_id: string, link: string, username: string): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/class/delete-member`, { session_id, link, username });
  }
  leave(session_id: string, link: string): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/class/leave`, { session_id, link });
  }
  editRole(session_id: string, link: string, username: string): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/class/edit-role`, { session_id, link, username });
  }
}