import { Component } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { AdvancedFormatMessagePipe } from '../../../pipes/advanced-message.pipe';
import { MessagesService } from '../../../services/message.service';

@Component({
  selector: 'app-chat',
  imports: [CommonModule, RouterModule, ReactiveFormsModule, AdvancedFormatMessagePipe,
    MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule],
  templateUrl: './chat.html',
  styleUrl: './chat.css',
})
export class Chat {
  public user: any | null = null;  
  public messages$: Observable<any[] | null>;
  public hasMore$: Observable<boolean>;
  chatForm: FormGroup;

  constructor(
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
  }

  ngOnInit(): void {
    this.route.data.subscribe(data => {
      this.user = data['profile'];
      if (this.user?.username) {
        this.messagesService.loadMessagesForUser(this.user.username);
      }
    });
  }
  ngOnDestroy() {
    this.messagesService.clearMessages();
  }

  sendMessage(): void {
    if (this.chatForm.pending || this.chatForm.invalid) {
      return;
    }
    const { message } = this.chatForm.value;
    this.messagesService.sendMessageForUser(this.user.username, message);
    this.chatForm.reset();
  }
  
  public loadMoreMessages(): void {
    this.messagesService.loadMoreMessages();
  }

  public loadNewMessages(): void {
    this.messagesService.loadNewMessages();
  }
  
}