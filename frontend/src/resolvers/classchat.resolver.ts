import { Injectable } from '@angular/core';
import { Resolve, ActivatedRouteSnapshot } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { AuthService } from '@services/auth.service';
import { DataService } from '@services/data.service';
import { MessagesService } from '@services/message.service';
import { ClasschatService } from '@services/classchat.service';

@Injectable({ providedIn: 'root' })
export class ClassChatResolver implements Resolve<any[] > {
  private readonly MESSAGES_PER_LOAD = 50;

  constructor(
    private auth: AuthService,
    private dataService: DataService,
    private classchatService: ClasschatService
  ) {}

  resolve(route: ActivatedRouteSnapshot): Observable<any[]> {
    const link = route.paramMap.get('link');
    const sessionId = this.auth.tokenValue;

    if (!link || !sessionId) return of([]);

    return this.dataService.classchatDS.getMessages(sessionId, link, this.MESSAGES_PER_LOAD).pipe(
      tap((resp: any) => {
        this.classchatService.setInitialState(link, resp);
      }),
      map((resp: any) => resp?.messages ?? []),
      catchError(() => of([]))
    );
  }
}
