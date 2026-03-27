import { Inject, Injectable, PLATFORM_ID, OnDestroy } from '@angular/core';
import { BehaviorSubject, catchError, Observable, of, Subscription, tap, interval, switchMap, filter } from 'rxjs';
import { DataService } from './data.service';
import { AuthService } from './auth.service';
import { isPlatformBrowser } from '@angular/common';

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
  private oldestMessageNumber: number | null = null;
  private newestMessageNumber: number | null = null;
  private allMessages: any[] = [];
  private pollingSubscription: Subscription | null = null;
  
  private readonly POLLING_INTERVAL = 3000;
  private readonly MESSAGES_PER_LOAD = 8;
  private readonly MESSAGES_PER_PAGE = 8;

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
      this.loadInitialMessages(receiver_username);
    } else {
      this.loadInitialMessages(receiver_username);
    }
  }

  public loadMoreMessages(): void {
    if (this.currentReceiverUsername && this.oldestMessageNumber && this.newestMessageNumber && !this.isLoadingSubject.value) {
      this.isLoadingSubject.next(true);
      
      const session_id = this.authService.tokenValue;
      if (!session_id) {
        this.isLoadingSubject.next(false);
        return;
      }
      
      this.dataService.messageDS.getMessages(session_id, this.currentReceiverUsername, this.MESSAGES_PER_PAGE, this.oldestMessageNumber).pipe(
        tap((response: any) => {
          if (response && response.messages) {
            this.allMessages = [...response.messages, ...this.allMessages];
            this.messagesSubject.next(this.allMessages);
            
            this.oldestMessageNumber = response.oldestMessageNumber;
            this.hasMoreSubject.next(response.hasMore);

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

private markOutgoingMessagesAsRead(): void {
  let updated = false;
  for (const message of this.allMessages) {
    if (message.type === 'outgoing' && !message.is_read) {
      message.is_read = true;
      updated = true;
    }
  }
  if (updated) {
    this.messagesSubject.next([...this.allMessages]);
  }
}

public loadNewMessages(): void {
  if (this.currentReceiverUsername && !this.isLoadingSubject.value) {
    this.isLoadingSubject.next(true);

    const session_id = this.authService.tokenValue;
    if (!session_id) {
      this.isLoadingSubject.next(false);
      return;
    }

    if (!this.newestMessageNumber) {
      this.dataService.messageDS.getMessages(session_id, this.currentReceiverUsername, this.MESSAGES_PER_PAGE).pipe(
        tap((response: any) => {
          if (response && response.messages && response.messages.length > 0) {
            this.allMessages = response.messages;
            this.messagesSubject.next(this.allMessages);

            this.oldestMessageNumber = response.oldestMessageNumber;
            this.newestMessageNumber = response.newestMessageNumber;
            this.hasMoreSubject.next(response.hasMore);
            this.markOutgoingMessagesAsRead();

            if (this.newestMessageNumber) {
              this.startPolling();
            }
          }
          this.isLoadingSubject.next(false);
        }),
        catchError(error => {
          this.isLoadingSubject.next(false);
          return of(null);
        })
      ).subscribe();
    } else {
      this.dataService.messageDS.getNewMessages(session_id, this.currentReceiverUsername, this.newestMessageNumber).pipe(
        tap((response: any) => {
          if (response.is_last_outgoing_message_read) {
            this.markOutgoingMessagesAsRead();
          }
          if (response && response.messages && response.messages.length > 0) {
            this.allMessages = [...this.allMessages, ...response.messages];
            this.messagesSubject.next(this.allMessages);

            if (response.newestMessageNumber) {
              this.newestMessageNumber = response.newestMessageNumber;
            }


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
}

private startPolling(): void {
  if (!isPlatformBrowser(this.platformId)) return;
  this.stopPolling();

  const session_id = this.authService.tokenValue;
  if (!session_id || !this.currentReceiverUsername) {
    return;
  }

  this.pollingSubscription = interval(this.POLLING_INTERVAL).pipe(
    switchMap(() => {
      if (!this.currentReceiverUsername || !this.authService.tokenValue) {
        return of(null);
      }

      if (!this.newestMessageNumber) {
        return this.dataService.messageDS.getMessages(
          this.authService.tokenValue,
          this.currentReceiverUsername,
          this.MESSAGES_PER_PAGE
        ).pipe(catchError(error => of(null)));
      } else {
        return this.dataService.messageDS.getNewMessages(
          this.authService.tokenValue,
          this.currentReceiverUsername,
          this.newestMessageNumber
        ).pipe(catchError(error => of(null)));
      }
    }),
    filter(response => response !== null),
    tap((response: any) => {
      if (response.is_last_outgoing_message_read) {
        this.markOutgoingMessagesAsRead();
      }
      if (response && response.messages && response.messages.length > 0) {
        this.allMessages = [...this.allMessages, ...response.messages];
        this.messagesSubject.next(this.allMessages);

        if (response.newestMessageNumber) {
          this.newestMessageNumber = response.newestMessageNumber;
        } else if (response.messages && response.messages.length > 0) {
          const lastMessage = response.messages[response.messages.length - 1];
          if (lastMessage && lastMessage.message_number) {
            this.newestMessageNumber = lastMessage.message_number;
          }
        }
      }
    })
  ).subscribe();
}

  private stopPolling(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
      this.pollingSubscription = null;
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
      
      this.dataService.messageDS.getMessages(session_id, receiver_username, this.MESSAGES_PER_LOAD).pipe(
        tap((response: any) => {
          if (response) {
            this.allMessages = response.messages || [];
            this.messagesSubject.next(this.allMessages);
            
            this.oldestMessageNumber = response.oldestMessageNumber;
            this.newestMessageNumber = response.newestMessageNumber;
            this.hasMoreSubject.next(response.hasMore);
            

            this.startPolling();
          }
          this.isLoadingSubject.next(false);
        }),
        catchError(error => {
          this.messagesSubject.next([]);
          this.hasMoreSubject.next(false);
          this.isLoadingSubject.next(false);
          this.startPolling();
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
      this.dataService.messageDS.sendMessage(session_id, receiver_username, text).pipe(
        tap(() => {
          this.loadNewMessages();
        })
      ).subscribe();
    }
  }
  
  private resetState(): void {
    this.allMessages = [];
    this.oldestMessageNumber = null;
    this.newestMessageNumber = null;
    this.hasMoreSubject.next(false);
    this.messagesSubject.next([]);
    this.stopPolling();
  }

  public clearMessages(): void {
    this.resetState();
    this.currentReceiverUsername = null;
  }

  ngOnDestroy() {
    this.clearMessages();
    this.stopPolling(); 
  }
}