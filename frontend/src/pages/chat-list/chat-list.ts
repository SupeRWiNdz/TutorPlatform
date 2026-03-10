import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DataService } from '../../services/data-service/data.service';
import { AuthService } from '../../services/auth.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-chat-list',
  imports: [CommonModule],
  templateUrl: './chat-list.html',
  styleUrl: './chat-list.css',
})
export class ChatList implements OnInit {
  chats$: Observable<any>;

  constructor(
    private dataService: DataService,
    private authService: AuthService,
    private router: Router
  ) {
    this.chats$ = new Observable();
  }

  ngOnInit() {
    this.loadChats();
  }

  loadChats() {
    const sessionId = this.authService.tokenValue;

    if (!sessionId) {
      return;
    }

    this.chats$ = this.dataService.messageDS.getChats(sessionId);
  }

  navigateToChat(username: string) {
    this.router.navigate(['/chat', username]);
  }
}