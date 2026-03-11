import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ClasschatService } from '../../services/classchat.service';
import { Observable, tap } from 'rxjs';
import { CommonModule } from '@angular/common';
import { DataService } from '../../services/data-service/data.service';
import { AuthService } from '../../services/auth.service';

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
    private classchatService: ClasschatService,
    private dataService: DataService,
    private authService: AuthService) {
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
  public leave(): void {
    const sessionId = this.authService.tokenValue;
    const link = this.class.link;
    if (!link || !sessionId)
      return;
    this.dataService.classDS.leave(sessionId, link).pipe(
        tap(() => {
          this.router.navigate(['/']);
        })
      ).subscribe();
  }
  public deleteMember(username: string): void {
    const sessionId = this.authService.tokenValue;
    const link = this.class.link;
    if (!link || !sessionId || !username)
      return;
    this.dataService.classDS.deleteMember(sessionId, link, username).pipe(
        tap(() => {
          
        })
      ).subscribe();

  }
  
  public editRole(username: string, role: string): void {
    const sessionId = this.authService.tokenValue;
    const link = this.class.link;
    if (!link || !sessionId || !username || !role)
      return;
    const newRole: string = (role == 'student')?'teacher':'student';
    this.dataService.classDS.editRole(sessionId, link, username, newRole).pipe(
        tap(() => {
          
        })
      ).subscribe();

  }

  public loadMoreMessages(): void {
    this.classchatService.loadMoreMessages();
  }

  public loadNewMessages(): void {
    this.classchatService.loadNewMessages();
  }
}
