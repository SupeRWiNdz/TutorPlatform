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
import { DateToMonthNamePipe } from '@pipes/date-to-month-name.pipe';

@Component({
  selector: 'app-class-lessons',
  imports: [CommonModule, RouterModule, ReactiveFormsModule,
    MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, MatMenuModule, TruncatePipe, DateToMonthNamePipe],
  templateUrl: './class-lessons.html',
  styleUrl: './class-lessons.scss',
})

export class ClassLessons implements OnInit {
  public class: any | null = null;
  public isTitleActive: number = 50;
  public lessons$: Observable<any | null>;
  public lessonForm: FormGroup;
  public selectedLessonID: string | null = null;
  private _mode: 'edit' | 'create' | null = null;
  public get mode() { return this._mode }
  public createMode(date?: string): void {
    if (date)
      this.lessonForm.patchValue({ date: date });
    this.lessonForm.patchValue({ duration: '60' });
    this._mode = 'create';
  }
  public editMode(lesson_id: string, date?: string, time?: string, duration?: string, homework?: string): void {
    this.selectedLessonID=lesson_id;
    if (date) this.lessonForm.patchValue({ date: date });
    if (time) this.lessonForm.patchValue({ time: time });
    if (duration) this.lessonForm.patchValue({ duration: duration });
    if (homework) this.lessonForm.patchValue({ homework: homework });
    this._mode = 'edit';
  }
  public noMode(): void {
    this.lessonForm.reset();
    this._mode = null;
  }

  private _snackBar = inject(MatSnackBar);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private auth: AuthService,
    private cdr: ChangeDetectorRef,
    private lessonsService: LessonsService,
    private fb: FormBuilder
  ) {
    this.lessons$ = this.lessonsService.lessons$;
    this.lessonForm = this.fb.group({
      date: ['', [Validators.required, Validators.pattern(/^(0[1-9]|[12][0-9]|3[01])\.(0[1-9]|1[0-2])\.(19|20)\d\d$/)]],
      time: ['', [Validators.required, Validators.pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)]],
      duration: ['', [Validators.required, Validators.min(1), Validators.max(480)]],
      homework: ['', [Validators.maxLength(500)]]
    });
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
  public get isCurrentWeek(): boolean { return this.lessonsService.isCurrentWeek; }
  public get canEdit(): boolean {
    if (this.class.user_role == 'creator' || this.class.user_role == 'teacher')
      return true;
    return false;
  }
  public submitLessonForm(): void {
    const { tokenValue: sessionId } = this.auth;
    
    if (this._mode == null || !sessionId || !this.lessonForm.valid) return;
    const { date, time, duration, homework } = this.lessonForm.value;

    if (this._mode == 'create') {
      this.lessonsService.create(sessionId, this.class.link, date, time, homework, duration )
        .subscribe({
        next: (response) => {
          this.lessonsService.reloadWeek();
          this.noMode();
        }
      });
    }
    else if (this._mode == 'edit' && this.selectedLessonID) {
      this.lessonsService.edit(sessionId, this.selectedLessonID, date, time, homework, duration )
        .subscribe({
        next: (response) => {
          this.lessonsService.reloadWeek();
          this.noMode();
        }
      });
    }
  }
  public removeLesson(lesson_id: string): void {
    const { tokenValue: sessionId } = this.auth;
    if (!sessionId) return;
    this.lessonsService.remove(sessionId, lesson_id )
        .subscribe({
        next: (response) => {
          this.lessonsService.reloadWeek();
          this.noMode();
        }
      });
  }

}