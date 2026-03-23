import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../../services/auth.service';
import { DataService } from '../../../services/data.service';

@Component({
  selector: 'app-chat-list',
  imports: [CommonModule,
    MatButtonModule
  ],
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