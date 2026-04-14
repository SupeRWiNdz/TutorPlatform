import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { TruncatePipe } from "@pipes/truncate.pipe";
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable } from 'rxjs';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '@services/auth.service';
import { LessonsService } from '@services/lessons.service';
import { DateToMonthNamePipe } from "@pipes/date-to-month-name.pipe";
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-week-lessons',
  imports: [CommonModule, RouterModule, ReactiveFormsModule,
    MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, MatMenuModule, DateToMonthNamePipe],
  templateUrl: './week-lessons.html',
  styleUrl: './week-lessons.scss',
})
export class WeekLessons {
  private _snackBar = inject(MatSnackBar);
  openSnackBar(message: string) {
    this._snackBar.open(message, 'Закрыть', {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom'
    });
  }
  public lessons$: Observable<any | null>;
  public lessonForm: FormGroup;
  public selectedLessonID: string | null = null;
  private _mode: 'edit' | null = null;
  
  public get mode() { return this._mode }
  public editMode(lesson_id: string, date?: string, time?: string, duration?: string, homework?: string): void {
    this.selectedLessonID = lesson_id;
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
  constructor(
    private route: ActivatedRoute,
    private auth: AuthService,
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

  getDaysArray(weekData: any): Array<{ key: string, label: string, date: string, is_today: boolean, lessons: any[] }> {
    return this.lessonsService.getDaysArray(weekData);
  }
  public nextWeek(): void {
    this.lessonsService.nextWeek();
  }
  public previousWeek(): void {
    this.lessonsService.previousWeek();
  }
  public get isCurrentWeek(): boolean { return this.lessonsService.isCurrentWeek; }
  public submitLessonForm(): void {
    const { tokenValue: sessionId } = this.auth;

    if (this._mode == null || !sessionId || !this.lessonForm.valid) return;
    const { date, time, duration, homework } = this.lessonForm.value;
    
    if (this._mode == 'edit' && this.selectedLessonID) {
      this.noMode();
      this.lessonsService.edit(sessionId, this.selectedLessonID, date, time, homework, duration)
        .subscribe({
          next: (response) => {
            if (response.message) this.openSnackBar(response.message);
            this.lessonsService.reloadWeek();
          }
        });
    }
  }
  public removeLesson(lesson_id: string): void {
    const { tokenValue: sessionId } = this.auth;
    if (!sessionId) return;
    this.noMode();
    this.lessonsService.remove(sessionId, lesson_id)
      .subscribe({
        next: (response) => {
          if (response.message) this.openSnackBar(response.message);
          this.lessonsService.reloadWeek();
        }
      });
  }
}
