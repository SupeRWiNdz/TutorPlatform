import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Observable } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { TruncatePipe } from "@pipes/truncate.pipe";
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
  private _snackBar = inject(MatSnackBar);
  openSnackBar(message: string) {
    this._snackBar.open(message, 'Закрыть', {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom'
    });
  }
  public class: any | null = null;
  public isTitleActive: number = 50;
  private lessons$: Observable<any | null>;
  public lessonsList: any = null;
  public lessonForm: FormGroup;
  public selectedLessonID: string | null = null;
  private _mode: 'edit' | 'create' | 'view' | null = null;
  public get mode() { return this._mode }
  public createMode(date?: string): void {
    if (date)
      this.lessonForm.patchValue({ date: date });
    this.lessonForm.patchValue({ duration: '60' });
    this._mode = 'create';
  }
  public editMode(): void {
    this._mode = 'edit';
  }
  public viewMode(lesson_id: string): void {
    if (this.lessonToForm(lesson_id))
      this._mode = 'view';
  }
  public noMode(): void {
    this.lessonForm.reset();
    this._mode = null;
  }

  constructor(
    private route: ActivatedRoute,
    private lessonsService: LessonsService,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
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
    this.lessons$.subscribe(lessons => this.lessonsList = lessons);
  }

  private lessonToForm(lesson_id: string): boolean {
    if (!this.lessonsList?.lessons) return false;
    let foundLesson = null;
    let lessonDate = null;
    for (const dayKey of Object.keys(this.lessonsList.lessons)) {
      const day = this.lessonsList.lessons[dayKey];
      if (day.lessons && Array.isArray(day.lessons)) {
        const lesson = day.lessons.find((l: any) => l.id === lesson_id);
        if (lesson) {
          foundLesson = lesson;
          lessonDate = day.date;
          break;
        }
      }
    }
    if (foundLesson) {
      this.lessonForm.patchValue({
        date: lessonDate,
        time: foundLesson.time,
        duration: foundLesson.duration,
        homework: foundLesson.homework
      });
      this.selectedLessonID = lesson_id;
      return true;
    }
    return false;
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
    this.lessonsService.nextWeek().subscribe({
      next: () => { this.cdr.detectChanges(); }
    });
  }

  public previousWeek(): void {
    this.lessonsService.previousWeek().subscribe({
      next: () => { this.cdr.detectChanges(); }
    });
  }
  public get isCurrentWeek(): boolean { return this.lessonsService.isCurrentWeek; }
  public get canEdit(): boolean {
    if (this.class.user_role == 'creator' || this.class.user_role == 'teacher')
      return true;
    return false;
  }
  public submitLessonForm(): void {
    if (this._mode == null || !this.lessonForm.valid) return;
    this.lessonsService.submitForm(this.lessonForm, this.class.link, this.selectedLessonID, this._mode)
      .subscribe({
        next: (response) => {
          if (response.message)
            this.openSnackBar(response.message);
          this.reloadWeek();
        }
      });
    this.noMode();
  }

  public removeLesson(): void {
    if (!this.selectedLessonID) return;
    this.noMode();
    this.lessonsService.remove(this.selectedLessonID)
      .subscribe({
        next: (response) => {
          if (response.message)
            this.openSnackBar(response.message);
          this.reloadWeek();
        }
      });
  }
  private reloadWeek(): void {
    this.lessonsService.reloadWeek().subscribe({
      next: () => { this.cdr.detectChanges(); }
    });
  }
  public getEndTime(startTime: string, durationMinutes: number): string {
    return this.lessonsService.getEndTime(startTime,durationMinutes);
  }
}