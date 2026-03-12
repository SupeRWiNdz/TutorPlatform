import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ClasschatService } from '../../services/classchat.service';
import { catchError, Observable, of, tap } from 'rxjs';
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
    private authService: AuthService,
  private cdr: ChangeDetectorRef) {
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
    
    const userIndex = this.class.members.findIndex(
      (member: any) => member.username === username
    );

    if (userIndex === -1) return;

    this.dataService.classDS.deleteMember(sessionId, link, username).pipe(
    catchError(() => {
      return of(null);
    })
      ).subscribe({
      next: (response) => {
        this.class.members = this.class.members.filter(
          (member: any) => member.username !== username
        );
        this.cdr.detectChanges();
      }});

  }
public editRole(username: string, role: string): void {
  const sessionId = this.authService.tokenValue;
  const link = this.class.link;
  
  if (!link || !sessionId || !username || !role) {
    return;
  }
  
  const userIndex = this.class.members.findIndex(
    (member: any) => member.username === username
  );
  if (userIndex === -1) return;
  
  
  this.dataService.classDS.editRole(sessionId, link, username).pipe(
    catchError(() => {
      return of(null);
    })
  ).subscribe({
      next: (response) => {
        const updatedMembers = [...this.class.members];
        updatedMembers[userIndex] = {
          ...updatedMembers[userIndex],
          member_role: response.role
        };
        this.class.members = updatedMembers;
        this.cdr.detectChanges();
      }
    });
}
trackByMember(index: number, member: any): string {
  return member.username || `index_${index}_${member.member_role || ''}`;
}


  public loadMoreMessages(): void {
    this.classchatService.loadMoreMessages();
  }

  public loadNewMessages(): void {
    this.classchatService.loadNewMessages();
  }
}