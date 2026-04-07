import { Component, ElementRef, Inject, OnInit, PLATFORM_ID, ViewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Observable, Subscription } from 'rxjs';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AdvancedFormatMessagePipe } from '@pipes/advanced-message.pipe';
import { ClasschatService } from '@services/classchat.service';
import { TruncatePipe } from "@pipes/truncate.pipe";
import { DateTodayPipe } from "@pipes/date-today.pipe";
import { MatMenuModule } from '@angular/material/menu';

@Component({
  selector: 'app-class',
  imports: [CommonModule, RouterModule, ReactiveFormsModule, AdvancedFormatMessagePipe,
    MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, TruncatePipe, DateTodayPipe, MatMenuModule],
  templateUrl: './class-chat.html',
  styleUrl: './class-chat.scss',
})

export class ClassChat implements OnInit {
  private messagesSubscription: Subscription | null = null;
  public class: any | null = null;
  public messages$: Observable<any[] | null>;
  public hasMore$: Observable<boolean>;
  public chatForm: FormGroup;
  public isTitleActive: number = 50;
  private isBrowser = false;
  public initialScroll: boolean = false;

  constructor(
    @Inject(PLATFORM_ID) platformId: Object,
    private route: ActivatedRoute,
    private router: Router,
    private classchatService: ClasschatService,
    private fb: FormBuilder
  ) {
    this.messages$ = this.classchatService.messages$;
    this.hasMore$ = this.classchatService.hasMore$;
    this.chatForm = this.fb.group({
      message: ['', []]
    });
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    this.route.data.subscribe(data => {
      this.class = data['class'] ?? null;

      if (!this.class || !this.class.link) {
        return;
      }
      this.classchatService.loadMessagesForUser(this.class.link);
      this.messagesSubscription = this.messages$.subscribe(messages => {
      if (messages) {
        if (!this.initialScroll) {
          queueMicrotask(() => {
            this.scrollToBottom('instant');
            this.initialScroll = true;
          });
        }
        else if (this.getScrollPosition() == 'down') {
          queueMicrotask(() => this.scrollToBottom());
        }
      }
    });
    });
  }

  ngOnDestroy() {
    this.classchatService.clearMessages();
  }
  public navigateToChat(username: string) {
    this.router.navigate(['/chat', username]);
  }
  public sendMessage(): void {
    if (this.chatForm.pending || this.chatForm.invalid) {
      return;
    }
    const { message } = this.chatForm.value;
    this.classchatService.sendMessageForUser(this.class.link, message);
    this.chatForm.reset();
    queueMicrotask(() => this.scrollToBottom());
  }
  public loadMoreMessages(): void {
    this.classchatService.loadMoreMessages();
  }
  public loadNewMessages(): void {
    this.classchatService.loadNewMessages();
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