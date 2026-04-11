import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { catchError, Observable, of, tap, map } from 'rxjs';
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
import { LessonsService } from '@services/lessons.service';

@Component({
  selector: 'app-class-lessons',
  imports: [CommonModule, RouterModule, ReactiveFormsModule,
    MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, MatMenuModule, TruncatePipe],
  templateUrl: './class-lessons.html',
  styleUrl: './class-lessons.scss',
})

export class ClassLessons implements OnInit {
  public class: any | null = null;
  public isTitleActive: number = 50;
  public lessons$: Observable<any | null>;

  private _snackBar = inject(MatSnackBar);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private dataService: DataService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private lessonsService: LessonsService,
    private fb: FormBuilder
  ) {
    this.lessons$ = this.lessonsService.lessons$;
  }

  ngOnInit(): void {
    this.route.data.subscribe(data => {
      this.class = data['class'] ?? null;
    });
  }
  getDaysArray(weekData: any): Array<{ key: string, label: string, date: string, is_today: boolean, lessons: any[] }> {
    return this.lessonsService.getDaysArray(weekData);
  }
  public showTitle(): void {
    if (this.isTitleActive == 50)
      this.isTitleActive = -1;
    else
      this.isTitleActive = 50;
  }
  public nextWeek(): void {
    this.lessonsService.nextWeek();
  }
  public previousWeek(): void {
    this.lessonsService.previousWeek();
  }
  public get isCurrentWeek(): boolean {
    return this.lessonsService.isCurrentWeek;
  }
  public get canEdit(): boolean {
    if (this.class.user_role == 'creator' || this.class.user_role == 'teacher')
      return true;
    return false;
  }
}