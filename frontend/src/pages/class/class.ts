import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ClasschatService } from '../../services/classchat.service';
import { Observable } from 'rxjs';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-class',
  imports: [CommonModule, RouterModule],
  templateUrl: './class.html',
  styleUrl: './class.css',
})

export class Class implements OnInit{
  public class: any | null = null;  
  public messages$: Observable<any[] | null>;
  public hasMore$: Observable<boolean>;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private classchatService: ClasschatService) {
      this.messages$ = this.classchatService.messages$;
      this.hasMore$ = this.classchatService.hasMore$;
  }

  ngOnInit(): void {
    this.route.data.subscribe(data => {
      this.class = data['class'];
      if (this.class?.link) {
        this.classchatService.loadMessagesForUser(this.class.link);
      }
    });
  }
  ngOnDestroy() {
    this.classchatService.clearMessages();
  }
    navigateToChat(username: string) {
    this.router.navigate(['/chat', username]);
  }
  sendMessage(text: string): void {
    if (text?.trim() && this.class?.link) {
      this.classchatService.sendMessageForUser(this.class.link, text);
    }
  }
  
  public loadMoreMessages(): void {
    this.classchatService.loadMoreMessages();
  }

  public loadNewMessages(): void {
    this.classchatService.loadNewMessages();
  }
}
