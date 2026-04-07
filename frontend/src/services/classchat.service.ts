import { Inject, Injectable, PLATFORM_ID, OnDestroy } from '@angular/core';
import { BehaviorSubject, catchError, Observable, of, Subscription, tap, interval, switchMap, filter } from 'rxjs';
import { DataService } from './data.service';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class ClasschatService implements OnDestroy {

  private messagesSubject: BehaviorSubject<any[] | null>;
  public messages$: Observable<any[] | null>;

  private hasMoreSubject: BehaviorSubject<boolean>;
  public hasMore$: Observable<boolean>;

  private isLoadingSubject: BehaviorSubject<boolean>;
  public isLoading$: Observable<boolean>;

  private currentReceiverLink: string | null = null;
  private oldestMessageNumber: number | null = null;
  private newestMessageNumber: number | null = null;
  private allMessages: any[] = [];
  private pollingSubscription: Subscription | null = null;

  private readonly POLLING_INTERVAL = 3000;
  private readonly MESSAGES_PER_LOAD = 50;
  private readonly MESSAGES_PER_PAGE = 50;

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

  public loadMessagesForUser(receiver_link: string): void {
    if (this.currentReceiverLink !== receiver_link) {
      this.resetState();
      this.currentReceiverLink = receiver_link;
      this.loadInitialMessages(receiver_link);
    } else {
      this.loadInitialMessages(receiver_link);
    }
  }

  public setInitialState(receiver: string, response: any): void {
  this.resetState();
  this.currentReceiverLink = receiver;

  this.allMessages = response?.messages ?? [];
  this.messagesSubject.next(this.allMessages);

  this.oldestMessageNumber = response?.oldestMessageNumber ?? null;
  this.newestMessageNumber = response?.newestMessageNumber ?? null;
  this.hasMoreSubject.next(!!response?.hasMore);

  this.startPolling();
}

  public loadMoreMessages(): void {
    if (this.currentReceiverLink && this.oldestMessageNumber && this.newestMessageNumber && !this.isLoadingSubject.value) {
      this.isLoadingSubject.next(true);

      const session_id = this.authService.tokenValue;
      if (!session_id) {
        this.isLoadingSubject.next(false);
        return;
      }

      this.dataService.classchatDS.getMessages(session_id, this.currentReceiverLink, this.MESSAGES_PER_PAGE, this.oldestMessageNumber).pipe(
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
    if (this.currentReceiverLink && !this.isLoadingSubject.value) {
      this.isLoadingSubject.next(true);

      const session_id = this.authService.tokenValue;
      if (!session_id) {
        this.isLoadingSubject.next(false);
        return;
      }

      if (!this.newestMessageNumber) {
        this.dataService.classchatDS.getMessages(session_id, this.currentReceiverLink, this.MESSAGES_PER_PAGE).pipe(
          tap((response: any) => {
            if (response && response.messages && response.messages.length > 0) {
              this.allMessages = response.messages;
              this.messagesSubject.next(this.allMessages);

              this.oldestMessageNumber = response.oldestMessageNumber;
              this.newestMessageNumber = response.newestMessageNumber;
              this.hasMoreSubject.next(response.hasMore);

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
        this.dataService.classchatDS.getNewMessages(session_id, this.currentReceiverLink, this.newestMessageNumber).pipe(
          tap((response: any) => {
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
    this.stopPolling();

    const session_id = this.authService.tokenValue;
    if (!session_id || !this.currentReceiverLink) {
      return;
    }

    this.pollingSubscription = interval(this.POLLING_INTERVAL).pipe(
      switchMap(() => {
        if (!this.currentReceiverLink || !this.authService.tokenValue) {
          return of(null);
        }

        if (!this.newestMessageNumber) {
          return this.dataService.classchatDS.getMessages(
            this.authService.tokenValue,
            this.currentReceiverLink,
            this.MESSAGES_PER_PAGE
          ).pipe(
            catchError(error => {
              return of(null);
            })
          );
        } else {
          return this.dataService.classchatDS.getNewMessages(
            this.authService.tokenValue,
            this.currentReceiverLink,
            this.newestMessageNumber
          ).pipe(
            catchError(error => {
              return of(null);
            })
          );
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

  public sendMessageForUser(receiver_link: string, text: string): void {
    if (this.currentReceiverLink !== receiver_link) {
      this.currentReceiverLink = receiver_link;
    }
    this.sendMessage(receiver_link, text);
  }

  private loadInitialMessages(receiver_link: string): void {
    this.isLoadingSubject.next(true);

    const session_id = this.authService.tokenValue;

    if (session_id && receiver_link) {

      this.dataService.classchatDS.getMessages(session_id, receiver_link, this.MESSAGES_PER_LOAD).pipe(
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

  private sendMessage(receiver_link: string, text: string): void {
    const session_id = this.authService.tokenValue;

    if (session_id && receiver_link && text?.trim()) {
      this.dataService.classchatDS.sendMessage(session_id, receiver_link, text).pipe(
        tap(() => {
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
    this.currentReceiverLink = null;
  }

  ngOnDestroy() {
    this.clearMessages();
    this.stopPolling();
  }
}