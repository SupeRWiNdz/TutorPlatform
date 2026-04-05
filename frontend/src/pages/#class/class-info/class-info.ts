import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { catchError, of, tap } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { environment } from '../../../../environment';
import { AdvancedFormatMessagePipe } from '@pipes/advanced-message.pipe';
import { RoleIconPipe } from '@pipes/role-icon.pipe';
import { AuthService } from '@services/auth.service';
import { DataService } from '@services/data.service';
import { MessagesService } from '@services/message.service';
import { TruncatePipe } from "@pipes/truncate.pipe";
import { RoleNamePipe } from '@pipes/role-name.pipe';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-class',
  imports: [CommonModule, RouterModule, ReactiveFormsModule, AdvancedFormatMessagePipe, RoleIconPipe, RoleNamePipe,
    MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, MatMenuModule, TruncatePipe],
  templateUrl: './class-info.html',
  styleUrl: './class-info.scss',
})

export class ClassInfo implements OnInit {
  private _isEditing: boolean = false;
  private _deleteConfirm: boolean = false;
  public get isEditing(): boolean {
    return this._isEditing;
  }
  public get deleteConfirm(): boolean {
    return this._deleteConfirm;
  }
  public class: any | null = null;
  public editClassForm: FormGroup;
  public addMemberForm: FormGroup;
  public invitation: string = '';
  public addMemberError: string = '';
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
    this.editClassForm = new FormGroup({
      new_name: new FormControl('', [Validators.required, Validators.minLength(1), Validators.maxLength(100)]),
      new_description: new FormControl('', [Validators.maxLength(1000)]),
      new_link: new FormControl('', [Validators.required, Validators.pattern(/^[a-zA-Z0-9-]+$/), Validators.minLength(3), Validators.maxLength(20)])
    });
    this.addMemberForm = this.fb.group({
      username: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9-]+$/), Validators.minLength(3), Validators.maxLength(50)]]
    });
  }

  ngOnInit(): void {
    this.route.data.subscribe(data => {
      this.class = data['class'] ?? null;

      if (this.class?.name) {

        this.editClassForm.patchValue({
          new_name: this.class.name ?? '',
          new_description: this.class.description ?? '',
          new_link: this.class.link ?? ''
        });
      }
    });
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
    if (!link || !sessionId || !username) return;
    this.dataService.requestDS.create(sessionId, link, username).pipe(catchError(err => {
      this.addMemberError = err?.error?.message;
      return of(null);
    })
    ).subscribe({
      next: (response) => {
        this.addMemberForm.reset();
        const message = 'Приглашаю вас присоединиться в класс: "' + this.class.name + '" по ссылке: ' + environment.Url + '/request/' + response.link;
        this.messagesService.sendMessageForUser(username, message);
        this.openSnackBar(`Вы успешно пригласили ${username} присоединиться в класс`);
      }
    });
  }

  public editClass(): void {
    const { tokenValue: sessionId } = this.authService;
    const { link } = this.class;
    if (!link || !sessionId) return;
    if (!this.editClassForm.valid)
      {
        this.openSnackBar(`Вы ввели некорректные данные`);
        return;
      }
    const { new_name, new_link, new_description } = this.editClassForm.value;
    this.dataService.classDS.editClass(sessionId, link, new_name, new_link, new_description)
      .subscribe(({ changed_fields: { name, description, link } }) => {
        if (link) this.router.navigate(['/class', link, 'info']);
        if (name) this.class.name = name;
        if (description) this.class.description = description;
        this.exitEditMode();
        this.cdr.detectChanges();
        this.openSnackBar(`Вы успешно изменили данные класса`);
      });
  }
  public editMode(): void {
    this.exitDeleteMode()
    this._isEditing = true;
  }
  public exitEditMode(): void {
    this.editClassForm.patchValue({
      new_name: this.class.name ?? '',
      new_description: this.class.description ?? '',
      new_link: this.class.link ?? ''
    });
    this._isEditing = false;
  }
  public deleteMode(): void {
    this.exitEditMode();
    this._deleteConfirm = true;
  }
  public exitDeleteMode(): void {
    this._deleteConfirm = false;
  }
  public deleteClass(): void {
    const { tokenValue: sessionId } = this.authService;
    if (!sessionId) return;
    this.dataService.classDS.deleteClass(sessionId, this.class.link).subscribe((response: any) => {
      if (response) {
        this.openSnackBar(`Вы успешно удалили класс`);
        this.router.navigate(['/class']);
      }
    }
    )
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
}