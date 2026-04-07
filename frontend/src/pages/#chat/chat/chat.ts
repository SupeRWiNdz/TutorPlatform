import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, Inject, OnDestroy, OnInit, PLATFORM_ID, ViewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Observable, Subscription } from 'rxjs';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { AdvancedFormatMessagePipe } from '@pipes/advanced-message.pipe';
import { MessagesService } from '@services/message.service';
import { DateTodayPipe } from "@pipes/date-today.pipe";
import { TruncatePipe } from "@pipes/truncate.pipe";
import { MatMenuModule } from '@angular/material/menu';

@Component({
  selector: 'app-chat',
  imports: [CommonModule, RouterModule, ReactiveFormsModule, AdvancedFormatMessagePipe, TruncatePipe, DateTodayPipe,
    MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, MatMenuModule ],
  templateUrl: './chat.html',
  styleUrl: './chat.scss',
})
export class Chat implements OnInit, OnDestroy {
  private messagesSubscription: Subscription | null = null;
  public user: any | null = null;
  public messages$: Observable<any[] | null>;
  public hasMore$: Observable<boolean>;
  chatForm: FormGroup;
  private isBrowser = false;
  public initialScroll: boolean = false;
  public isTitleActive: number = 50;

  constructor(
    @Inject(PLATFORM_ID) platformId: Object,
    private route: ActivatedRoute,
    private messagesService: MessagesService,
    public router: Router,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {
    this.messages$ = this.messagesService.messages$;
    this.hasMore$ = this.messagesService.hasMore$;

    this.chatForm = this.fb.group({
      message: ['', []]
    });
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    this.route.data.subscribe(data => {
      this.user = data['profile'];
      if (this.user?.username) {
        this.messagesService.loadMessagesForUser(this.user.username);
      }
    });

    this.messagesSubscription = this.messages$.subscribe(messages => {
      if (messages) {
        if (!this.initialScroll) {
          this.cdr.detectChanges();
          setTimeout(() => {
            this.scrollToBottom('instant');
            this.initialScroll = true;
          }, 0);
        }
        else if (this.getScrollPosition() == 'down') {
          this.cdr.detectChanges();
          setTimeout(() => this.scrollToBottom(), 0);
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.messagesSubscription?.unsubscribe();
    this.messagesService.clearMessages();
  }

  sendMessage(): void {
    if (this.chatForm.pending || this.chatForm.invalid) {
      return;
    }
    const { message } = this.chatForm.value;
    this.messagesService.sendMessageForUser(this.user.username, message);

    this.chatForm.reset();
    this.cdr.detectChanges();
    setTimeout(() => this.scrollToBottom(), 0);
  }

  public loadMoreMessages(): void {
    this.messagesService.loadMoreMessages();
  }

  public loadNewMessages(): void {
    this.messagesService.loadNewMessages();
  }

  @ViewChild('messagesContainer') scrollBox?: ElementRef<HTMLElement>;

  public getScrollPosition(): string | null {
    if (!this.isBrowser) return null;

    const container = this.scrollBox?.nativeElement;
    if (!container) return null;

    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;

    if (scrollHeight == clientHeight)
      return 'all';
    else if ((scrollHeight - clientHeight - scrollTop) < 210)
      return 'down';
    else if (scrollTop < 210)
      return 'up';
    else
      return 'center';
  }

  scrollToBottom(behavior: ScrollBehavior = 'smooth') {
    if (!this.isBrowser) return;
    const el = this.scrollBox?.nativeElement;
    if (!el) return;
    this.safeScrollTo(el, el.scrollHeight, behavior);
  }

  scrollToTop(behavior: ScrollBehavior = 'smooth') {
    if (!this.isBrowser) return;
    const el = this.scrollBox?.nativeElement;
    if (!el) return;
    this.safeScrollTo(el, 0, behavior);
  }

  private safeScrollTo(el: HTMLElement, top: number, behavior: ScrollBehavior) {
    if (typeof (el as any).scrollTo === 'function') {
      el.scrollTo({ top, behavior });
    } else {
      el.scrollTop = top;
    }
  }

  public showTitle(): void {
    if (this.isTitleActive == 50)
      this.isTitleActive = -1;
    else
      this.isTitleActive = 50;
  }
}