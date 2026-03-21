import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ClasschatService } from '../../services/classchat.service';
import { catchError, Observable, of, tap } from 'rxjs';
import { CommonModule } from '@angular/common';
import { DataService } from '../../services/data-service/data.service';
import { AuthService } from '../../services/auth.service';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MessagesService } from '../../services/message.service';
import { AdvancedFormatMessagePipe } from '../../services/advanced-message.pipe';

@Component({
  selector: 'app-class',
  imports: [CommonModule, RouterModule, ReactiveFormsModule, AdvancedFormatMessagePipe],
  templateUrl: './class.html',
  styleUrl: './class.css',
})

export class Class implements OnInit{
  private _page: 1 | 2 = 1;
  public get page(): 1 | 2 {
  return this._page;
  }
  private _isEditing: boolean = false;
  private _deleteConfirm: boolean = false;
  public get isEditing(): boolean {
  return this._isEditing;
  }
  public get deleteConfirm(): boolean {
  return this._deleteConfirm;
  }
  public class: any | null = null;  
  public messages$: Observable<any[] | null>;
  public hasMore$: Observable<boolean>;
  public editClassForm: FormGroup;
  public addMemberForm: FormGroup;
  public chatForm: FormGroup;
  public invitation: string='';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private classchatService: ClasschatService,
    private dataService: DataService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private messagesService: MessagesService,
    private fb: FormBuilder
  )
    {
      this.messages$ = this.classchatService.messages$;
      this.hasMore$ = this.classchatService.hasMore$;
      this.editClassForm = new FormGroup({
      new_name: new FormControl('', [Validators.minLength(1), Validators.maxLength(100)]),
      new_description: new FormControl('', [Validators.maxLength(1000)]),
      new_link: new FormControl('', [Validators.pattern(/^[a-zA-Z0-9-]+$/), Validators.minLength(3), Validators.maxLength(20)])
    });
      this.addMemberForm = this.fb.group({
      username: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9-]+$/), Validators.minLength(3), Validators.maxLength(50)]]
    });
      this.chatForm = this.fb.group({
      message: ['', [Validators.required]]
    });
  }

ngOnInit(): void {
  this.route.data.subscribe(data => {
    this.class = data['class'] ?? null;

    if (!this.class) {
      return;
    }

    if (this.class.link) {
      this.classchatService.loadMessagesForUser(this.class.link);
    }

    this.editClassForm.patchValue({
      new_name: this.class.name ?? '',
      new_description: this.class.description ?? '',
      new_link: this.class.link ?? ''
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
      next: () => {
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
        if (response) {
        const updatedMembers = [...this.class.members];
        updatedMembers[userIndex] = {
          ...updatedMembers[userIndex],
          member_role: response.role
        };
        this.class.members = updatedMembers;
        this.cdr.detectChanges();
      }
      }
    });
}
  public trackByMember(index: number, member: any): string {
  return member.username || `index_${index}_${member.member_role || ''}`;
  }
  public loadMoreMessages(): void {
    this.classchatService.loadMoreMessages();
  }
  public loadNewMessages(): void {
    this.classchatService.loadNewMessages();
  }
  public addMember(): void {
    const sessionId = this.authService.tokenValue;
    const link = this.class.link;
    const { username } = this.addMemberForm.value;
    if (!link || !sessionId || !username) return;
    this.dataService.requestDS.create(sessionId, link, username).pipe().subscribe({
      next: (response) => {
          this.addMemberForm.reset();
          const message = 'Приглашаю вас присоединиться в класс: "'+this.class.name+'" по ссылке: '+'http://localhost:4200/request/'+response.link;
          this.messagesService.sendMessageForUser(username, message);
          this.chatForm.reset();
      }
    });
  }

    public editClass(): void {
      const { tokenValue: sessionId } = this.authService;
      const { link } = this.class;
      if (!link || !sessionId || !this.editClassForm.valid) return;
      const { new_name, new_link, new_description } = this.editClassForm.value;
      this.dataService.classDS.editClass(sessionId, link, new_name, new_link, new_description)
        .subscribe(({ changed_fields: { name, description, link } }) => {
          if (link) this.router.navigate(['/class', link]);
          if (name) this.class.name = name;
          if (description) this.class.description = description;
          this.exitEditMode();
          this.cdr.detectChanges();
        });
    }
    public editMode(): void {
      this.exitDeleteMode()
      this._isEditing=true;
    }
    public exitEditMode(): void {
      this.editClassForm.patchValue({
      new_name: this.class.name ?? '',
      new_description: this.class.description ?? '',
      new_link: this.class.link ?? ''
    });
      this._isEditing=false;
    }
    public deleteMode(): void {
      this.exitEditMode();
      this._deleteConfirm=true;
    }
    public exitDeleteMode(): void {
      this._deleteConfirm=false;
    }
    public deleteClass(): void {
    const { tokenValue: sessionId } = this.authService;
    if (!sessionId) return;
    this.dataService.classDS.deleteClass(sessionId, this.class.link).subscribe((response: any) => {
    if (response) {
      this.router.navigate(['/class']);
    }    
    }
    )
    }

    public createRequest(): void {
      const { tokenValue: sessionId } = this.authService;
      const { link } = this.class;
      if (!link || !sessionId) return;
      this.dataService.requestDS.create(sessionId, link)
        .subscribe({next: (response) => {
        if (response) {
          this.invitation='http://localhost:4200/request/'+response.link;
          this.cdr.detectChanges();
      }
      }
    });
    }
    
    public pageOne(): void {
      this.exitEditMode();
      this.exitDeleteMode()
      this._page=1;
    }
    public pageTwo(): void {
      this._page=2;
    }
}