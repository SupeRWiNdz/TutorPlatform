import { Inject, Injectable, PLATFORM_ID, OnDestroy } from '@angular/core';
import { BehaviorSubject, catchError, Observable, of, Subscription, tap, interval, switchMap, takeUntil } from 'rxjs';
import { DataService } from './data.service';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class MessagesService implements OnDestroy {
  
  private messagesSubject: BehaviorSubject<any | null>;
  public messages$: Observable<any | null>;
  
  private currentReceiverUsername: string | null = null;
  private pollingSubscription: Subscription | null = null;
  private lastMessageCount: number = 0;
  
  private readonly POLLING_INTERVAL = 3000;

  constructor(
    private dataService: DataService,
    private authService: AuthService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.messagesSubject = new BehaviorSubject<any | null>(null);
    this.messages$ = this.messagesSubject.asObservable();
  }

  public loadMessagesForUser(receiver_username: string): void {
    if (this.currentReceiverUsername !== receiver_username) {
      this.currentReceiverUsername = receiver_username;
      this.stopPolling();
      this.loadMessages(receiver_username);
      this.startPolling(receiver_username);
    } else {
      this.loadMessages(receiver_username);
    }
  }

  public sendMessageForUser(receiver_username: string, text: string): void {
    if (this.currentReceiverUsername !== receiver_username) {
      this.currentReceiverUsername = receiver_username;
    }
    this.sendMessage(receiver_username, text);
  }

  private loadMessages(receiver_username: string): void {
    const session_id = this.authService.tokenValue;
    
    if (session_id && receiver_username) {
      this.dataService.getMessages(session_id, receiver_username).pipe(
        tap(messages => {
          this.messagesSubject.next(messages);
          this.lastMessageCount = messages?.length || 0;
        }),
        catchError(error => {
          this.messagesSubject.next(null);
          return of(null);
        })
      ).subscribe();
    }
  }

  private sendMessage(receiver_username: string, text: string): void {
    const session_id = this.authService.tokenValue;

    if (session_id && receiver_username && text?.trim()) {
      this.dataService.sendMessage(session_id, receiver_username, text).pipe(
        tap(response => {
          this.loadMessages(receiver_username);
        }),
        catchError(error => {
          return of(null);
        })
      ).subscribe();
    }
  }

  private startPolling(receiver_username: string): void {
    if (this.pollingSubscription) {
      this.stopPolling();
    }

    this.pollingSubscription = interval(this.POLLING_INTERVAL).pipe(
      switchMap(() => {
        const session_id = this.authService.tokenValue;
        if (session_id && receiver_username) {
          return this.dataService.getMessages(session_id, receiver_username).pipe(
            catchError(error => of(null))
          );
        }
        return of(null);
      })
    ).subscribe(messages => {
      if (messages && this.messagesSubject.value) {
        if (messages.length > this.lastMessageCount) {
          this.messagesSubject.next(messages);
          this.lastMessageCount = messages.length;
        }
      } else if (messages) {
        this.messagesSubject.next(messages);
        this.lastMessageCount = messages.length;
      }
    });
  }

  private stopPolling(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
      this.pollingSubscription = null;
    }
  }

  public clearMessages(): void {
    this.stopPolling();
    this.messagesSubject.next(null);
    this.currentReceiverUsername = null;
    this.lastMessageCount = 0;
  }

  ngOnDestroy() {
    this.clearMessages();
  }
}