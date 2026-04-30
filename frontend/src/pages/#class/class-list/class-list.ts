import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RoleIconPipe } from '@pipes/role-icon.pipe';
import { AuthService } from '@services/auth.service';
import { DataService } from '@services/data.service';
import { TruncatePipe } from '@pipes/truncate.pipe';
import { RoleNamePipe } from "@pipes/role-name.pipe";
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DateTodayPipe } from "@pipes/date-today.pipe";

@Component({
  selector: 'app-class-list',
  imports: [CommonModule, ReactiveFormsModule, RoleIconPipe, TruncatePipe,
    MatIconModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatProgressSpinnerModule, RoleNamePipe, MatMenuModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './class-list.html',
  styleUrl: './class-list.scss',
})

export class ClassList implements OnInit {
  classes$: Observable<any>;
  private _isCreating: boolean = false;
  public get isCreating(): boolean {
    return this._isCreating;
  }
  public createClassForm: FormGroup;
  private _snackBar = inject(MatSnackBar);
  openSnackBar(message: string) {
    this._snackBar.open(message, 'Закрыть', {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom'
    });
  }

  constructor(
    private fb: FormBuilder,
    private dataService: DataService,
    private authService: AuthService,
    private router: Router
  ) {
    this.classes$ = new Observable<any>
    this.createClassForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(1), Validators.maxLength(100)]],
      description: ['', [Validators.maxLength(1000)]],
      link: ['', [Validators.required, Validators.pattern(/^[a-zA-Z-]+$/), Validators.minLength(3), Validators.maxLength(20)]]
    });
  }

  ngOnInit() {
    const sessionId = this.authService.tokenValue;

    if (!sessionId) {
      return;
    }

    this.classes$ = this.dataService.classDS.myClasses(sessionId);
  }

  navigateToClass(link: string) {
    this.router.navigate(['/class', link]);
  }

  trackByClass(index: number, classItem: any): string {
    return classItem.link;
  }

  public createMode(): void {
    this._isCreating = true;
  }
  public exitCreateMode(): void {
    this._isCreating = false;
    this.createClassForm.reset();
  }
  public createClass(): void {
    const { tokenValue: sessionId } = this.authService;
    if (!sessionId || !this.createClassForm.valid) return;
    const { name, link, description } = this.createClassForm.value;
    this.dataService.classDS.createClass(sessionId, name, link, description)
      .subscribe(({ class: { link } }) => {
        if (link) {
          this.openSnackBar('Вы успешно создали новый класс: '+name);
          this.router.navigate(['/class', link]);
        }
      });
  }
}