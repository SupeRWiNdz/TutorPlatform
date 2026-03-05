import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { User } from '../../models/auth.models';
import { MessagesService } from '../../services/message.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-chat',
  imports: [CommonModule],
  templateUrl: './chat.html',
  styleUrl: './chat.css',
})
export class Chat {
  public user: User | null = null;  
  public messages$: Observable<any[] | null>;
  public hasMore$: Observable<boolean>;

  constructor(
    private route: ActivatedRoute,
    private messagesService: MessagesService
  ) {
    this.messages$ = this.messagesService.messages$;
    this.hasMore$ = this.messagesService.hasMore$;
  }

  ngOnInit(): void {
    this.route.data.subscribe(data => {
      this.user = data['profile'];
      if (this.user?.username) {
        this.messagesService.loadMessagesForUser(this.user.username);
      }
    });
  }

  sendMessage(text: string): void {
    if (text?.trim() && this.user?.username) {
      this.messagesService.sendMessageForUser(this.user.username, text);
    }
  }
  
  public loadMoreMessages(): void {
    this.messagesService.loadMoreMessages();
  }
}