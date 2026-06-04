import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { BehaviorSubject, catchError, Observable, of, tap } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { environment } from '../../../environment';
import { RoleIconPipe } from '@pipes/role-icon.pipe';
import { AuthService } from '@services/auth.service';
import { DataService } from '@services/data.service';
import { MessagesService } from '@services/message.service';
import { TruncatePipe } from "@pipes/truncate.pipe";
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSelectModule } from "@angular/material/select";

@Component({
  selector: 'app-class-members',
  imports: [CommonModule, RouterModule, ReactiveFormsModule, RoleIconPipe,
    MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, MatMenuModule, TruncatePipe, MatSelectModule],
  templateUrl: './class-members.html',
  styleUrl: './class-members.scss',
})

export class ClassMembers implements OnInit {
  private usersToInviteSubject: BehaviorSubject<any[] | null>;
  public usersToInvite$: Observable<any[] | null>;
  public class: any | null = null;
  public addMemberForm: FormGroup;
  public invitation: string = '';
  public isTitleActive: number = 50;
  private _snackBar = inject(MatSnackBar);
  openSnackBar(message: string) {
    this._snackBar.open(message, 'Закрыть', {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom'
    });
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private dataService: DataService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private messagesService: MessagesService,
    private fb: FormBuilder
  ) {
    this.usersToInviteSubject = new BehaviorSubject<any | null>(null);
    this.usersToInvite$ = this.usersToInviteSubject.asObservable();

    this.addMemberForm = this.fb.group({
      username: ['', [Validators.required]]
    });
  }

  ngOnInit(): void {
    this.route.data.subscribe(data => {
      this.class = data['class'] ?? null;
      if (this.class?.link) {
        this.usersToInvite().subscribe();
      }
    });
  }

  private usersToInvite(): Observable<any> {
    const sessionId = this.authService.tokenValue;
    const link = this.class?.link;
    if (!link || !sessionId) return of(null);
    return this.dataService.requestDS.getUsersToInvite(sessionId, link).pipe(
      tap(response => {
        if (response.users)
          this.usersToInviteSubject.next(response.users)
      }),
      catchError(() => of(null))
    );
  }

  public leave(): void {
    if (!this.class?.name) return;
    const sessionId = this.authService.tokenValue;
    const link = this.class.link;
    if (!link || !sessionId)
      return;
    this.dataService.classDS.leave(sessionId, link).pipe(
      tap(() => {
        this.openSnackBar('Вы успешно вышли из класса');
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
        this.openSnackBar('Вы успешно удалили участника класса: ' + username);
        this.class.members = this.class.members.filter(
          (member: any) => member.username !== username
        );
        this.cdr.detectChanges();
      }
    });

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
          let newRole: string = '';
          if (response.role == 'teacher') {
            newRole = 'учителя';
          } else if (response.role == 'student') {
            newRole = 'ученика';
          }
          this.openSnackBar(`Вы успешно изменили роль участника ${username} на ${newRole}`);
        }
      }
    });
  }
  public addMember(): void {
    const sessionId = this.authService.tokenValue;
    const link = this.class.link;
    const { username } = this.addMemberForm.value;
    if (!username)
      this.openSnackBar(`Выберите пользователя, которого хотите добавить`);
    if (!link || !sessionId || !username) return;
    this.dataService.requestDS.create(sessionId, link, username).pipe(catchError(err => {
      this.openSnackBar(err?.error?.message);
      return of(null);
    })).subscribe({
      next: (response) => {
        if (response) {
          this.addMemberForm.reset();
          const message = 'Приглашаю вас присоединиться в класс: "' + this.class.name + '" по ссылке: ' + environment.Url + '/request/' + response.link;
          this.messagesService.sendMessageForUser(username, message);
          this.openSnackBar(`Вы успешно пригласили ${username} присоединиться в класс`);
        }
      }
    });
  }

  public createInvitation(): void {
    const { tokenValue: sessionId } = this.authService;
    const { link } = this.class;
    if (!link || !sessionId) return;
    this.dataService.requestDS.create(sessionId, link)
      .subscribe({
        next: (response) => {
          if (response) {
            this.invitation = environment.Url + '/request/' + response.link;
            this.cdr.detectChanges();
            this.openSnackBar(`Вы создали общее приглашение`);
          }
        }
      });
  }
  public showTitle(): void {
    if (this.isTitleActive == 50)
      this.isTitleActive = -1;
    else
      this.isTitleActive = 50;
  }

  copyText(text: string) {
    navigator.clipboard.writeText(text);
    this.openSnackBar(`Вы скопировали ссылку на приглашение в класс`);
  }
}