import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environment';

@Injectable({
  providedIn: 'root'
})
export class MessageDataService {
  private apiUrl = environment.apiUrl;
  constructor(private http: HttpClient) {  }

  getMessages(session_id: string, receiver_username: string, message_count?: number, before_number?: number): Observable<any> {
    const payload: any = { session_id, receiver_username, message_count };
    if (before_number) {
      payload.before_number = before_number;
    }
    return this.http.post<any>(`${this.apiUrl}/messages/get`, payload);
  }
  getNewMessages(session_id: string, receiver_username: string, after_number: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/messages/get-new`, { session_id, receiver_username, after_number });
  }
  sendMessage(session_id: string, receiver_username: string, text: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/messages/send`, { session_id, receiver_username, text });
  }
  getChats(session_id: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/messages/chats`, { session_id });
  }
}