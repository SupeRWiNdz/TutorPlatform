import { Inject, Injectable, PLATFORM_ID, OnDestroy } from '@angular/core';
import { BehaviorSubject, catchError, Observable, of, Subscription, tap, interval, switchMap } from 'rxjs';
import { DataService } from './data.service';
import { AuthService } from './auth.service';

export interface MessagesResponse {
  messages: any[];
  hasMore: boolean;
  oldestMessageDate: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class MessagesService implements OnDestroy {
  
  private messagesSubject: BehaviorSubject<any[] | null>;
  public messages$: Observable<any[] | null>;
  
  private hasMoreSubject: BehaviorSubject<boolean>;
  public hasMore$: Observable<boolean>;
  
  private isLoadingSubject: BehaviorSubject<boolean>;
  public isLoading$: Observable<boolean>;
  
  private currentReceiverUsername: string | null = null;
  private oldestMessageDate: string | null = null;
  private allMessages: any[] = [];
  
  private pollingSubscription: Subscription | null = null;
  private lastMessageCount: number = 0;
  
  private readonly POLLING_INTERVAL = 3000;
  private readonly MESSAGES_PER_LOAD = 8;
  private readonly MESSAGES_PER_PAGE = 4;

  constructor(
    private dataService: DataService,
    private authService: AuthService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.messagesSubject = new BehaviorSubject<any[] | null>(null);
    this.messages$ = this.messagesSubject.asObservable();
    
    this.hasMoreSubject = new BehaviorSubject<boolean>(false);
    this.hasMore$ = this.hasMoreSubject.asObservable();
    
    this.isLoadingSubject = new BehaviorSubject<boolean>(false);
    this.isLoading$ = this.isLoadingSubject.asObservable();
  }

  public loadMessagesForUser(receiver_username: string): void {
    if (this.currentReceiverUsername !== receiver_username) {
      this.resetState();
      this.currentReceiverUsername = receiver_username;
      this.stopPolling();
      this.loadInitialMessages(receiver_username);
      this.startPolling(receiver_username);
    } else {
      this.loadInitialMessages(receiver_username);
    }
  }

  public loadMoreMessages(): void {
    if (this.currentReceiverUsername && this.oldestMessageDate && !this.isLoadingSubject.value) {
      this.isLoadingSubject.next(true);
      
      const session_id = this.authService.tokenValue;
      if (!session_id) {
        this.isLoadingSubject.next(false);
        return;
      }
      
      this.dataService.getMessages(session_id, this.currentReceiverUsername, this.MESSAGES_PER_PAGE, this.oldestMessageDate).pipe(
        tap((response: MessagesResponse) => {
          if (response && response.messages) {
            this.allMessages = [...response.messages, ...this.allMessages];
            this.messagesSubject.next(this.allMessages);
            
            this.oldestMessageDate = response.oldestMessageDate;
            this.hasMoreSubject.next(response.hasMore);
            
            this.lastMessageCount = this.allMessages.length;
          }
          this.isLoadingSubject.next(false);
        }),
        catchError(error => {
          this.isLoadingSubject.next(false);
          return of(null);
        })
      ).subscribe();
    }
  }

  public sendMessageForUser(receiver_username: string, text: string): void {
    if (this.currentReceiverUsername !== receiver_username) {
      this.currentReceiverUsername = receiver_username;
    }
    this.sendMessage(receiver_username, text);
  }

  private loadInitialMessages(receiver_username: string): void {
    this.isLoadingSubject.next(true);
    
    const session_id = this.authService.tokenValue;
    
    if (session_id && receiver_username) {
      this.dataService.getMessages(session_id, receiver_username, this.MESSAGES_PER_LOAD).pipe(
        tap((response: MessagesResponse) => {
          if (response) {
            this.allMessages = response.messages || [];
            this.messagesSubject.next(this.allMessages);
            
            this.oldestMessageDate = response.oldestMessageDate;
            this.hasMoreSubject.next(response.hasMore);
            
            this.lastMessageCount = this.allMessages.length;
            
            console.log('Messages loaded:', {
              count: this.allMessages.length,
              hasMore: response.hasMore,
              oldestDate: response.oldestMessageDate
            });
          }
          this.isLoadingSubject.next(false);
        }),
        catchError(error => {
          console.error('Error loading messages:', error);
          this.messagesSubject.next([]);
          this.hasMoreSubject.next(false);
          this.isLoadingSubject.next(false);
          return of(null);
        })
      ).subscribe();
    } else {
      this.isLoadingSubject.next(false);
    }
  }

  private sendMessage(receiver_username: string, text: string): void {
    const session_id = this.authService.tokenValue;

    if (session_id && receiver_username && text?.trim()) {
      this.dataService.sendMessage(session_id, receiver_username, text).pipe(
        tap(response => {
          console.log('Message sent, reloading messages');
          this.loadInitialMessages(receiver_username);
        }),
        catchError(error => {
          console.error('Error sending message:', error);
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
        // Запрашиваем только ОДНО последнее сообщение для проверки
        return this.dataService.getMessages(session_id, receiver_username, 1).pipe(
          catchError(error => {
            console.error('Polling error:', error);
            return of(null);
          })
        );
      }
      return of(null);
    })
  ).subscribe((response: MessagesResponse | null) => {
    if (response && response.messages && response.messages.length > 0) {
      const latestPolledMessage = response.messages[0];
      const currentLatestMessage = this.allMessages.length > 0 ? this.allMessages[this.allMessages.length - 1] : null;
      
      // Проверяем, появилось ли новое сообщение
      if (!currentLatestMessage || 
          latestPolledMessage.id !== currentLatestMessage.id || 
          latestPolledMessage.sent_at !== currentLatestMessage.sent_at) {
        
        console.log('New message detected, reloading all messages');
        
        // Если появилось новое сообщение, перезагружаем все сообщения
        const session_id = this.authService.tokenValue;
        if (session_id && receiver_username) {
          this.dataService.getMessages(session_id, receiver_username, this.MESSAGES_PER_LOAD).pipe(
            tap((fullResponse: MessagesResponse) => {
              if (fullResponse) {
                this.allMessages = fullResponse.messages || [];
                this.messagesSubject.next(this.allMessages);
                
                this.oldestMessageDate = fullResponse.oldestMessageDate;
                this.hasMoreSubject.next(fullResponse.hasMore);
                
                this.lastMessageCount = this.allMessages.length;
              }
            }),
            catchError(error => {
              console.error('Error reloading messages after polling:', error);
              return of(null);
            })
          ).subscribe();
        }
      }
    }
  });
}

  private stopPolling(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
      this.pollingSubscription = null;
    }
  }

  private resetState(): void {
    this.allMessages = [];
    this.oldestMessageDate = null;
    this.hasMoreSubject.next(false);
    this.lastMessageCount = 0;
    this.messagesSubject.next([]);
  }

  public clearMessages(): void {
    this.stopPolling();
    this.resetState();
    this.currentReceiverUsername = null;
  }

  ngOnDestroy() {
    this.clearMessages();
  }
}