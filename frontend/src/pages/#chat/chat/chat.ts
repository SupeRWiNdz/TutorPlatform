import { AfterViewInit, Component, ElementRef, Inject, OnDestroy, OnInit, PLATFORM_ID, ViewChild } from '@angular/core';
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

@Component({
  selector: 'app-chat',
  imports: [CommonModule, RouterModule, ReactiveFormsModule, AdvancedFormatMessagePipe,
    MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, DateTodayPipe],
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
  private initialScroll: boolean = false;

  constructor(
    @Inject(PLATFORM_ID) platformId: Object,
    private route: ActivatedRoute,
    private messagesService: MessagesService,
    public router: Router,
    private fb: FormBuilder
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
        setTimeout(() => this.scrollToBottom(), 100);
      }
    });

    this.messagesSubscription = this.messages$.subscribe(messages => {
      if (messages) {
        if (this.getScrollPosition() == 'down')
          setTimeout(() => this.scrollToBottom(), 1);
        else if (!this.initialScroll) {
          setTimeout(() => this.scrollToBottom('instant'), 1);
          this.initialScroll = false;
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
    setTimeout(() => this.scrollToBottom(), 100);
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
}