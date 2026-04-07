import { Injectable } from '@angular/core';
import { Resolve, ActivatedRouteSnapshot } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { AuthService } from '@services/auth.service';
import { DataService } from '@services/data.service';
import { MessagesService } from '@services/message.service';

@Injectable({ providedIn: 'root' })
export class ChatMessagesResolver implements Resolve<any[] > {
  private readonly MESSAGES_PER_LOAD = 50;

  constructor(
    private auth: AuthService,
    private dataService: DataService,
    private messagesService: MessagesService
  ) {}

  resolve(route: ActivatedRouteSnapshot): Observable<any[]> {
    const username = route.paramMap.get('username');
    const sessionId = this.auth.tokenValue;

    if (!username || !sessionId) return of([]);

    return this.dataService.messageDS.getMessages(sessionId, username, this.MESSAGES_PER_LOAD).pipe(
      tap((resp: any) => {
        this.messagesService.setInitialState(username, resp);
      }),
      map((resp: any) => resp?.messages ?? []),
      catchError(() => of([]))
    );
  }
}
