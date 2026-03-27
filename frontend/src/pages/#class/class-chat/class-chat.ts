import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Observable } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AdvancedFormatMessagePipe } from '../../../pipes/advanced-message.pipe';
import { ClasschatService } from '../../../services/classchat.service';

@Component({
  selector: 'app-class',
  imports: [CommonModule, RouterModule, ReactiveFormsModule, AdvancedFormatMessagePipe,
    MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './class-chat.html',
  styleUrl: './class-chat.scss',
})

export class ClassChat implements OnInit{
  public class: any | null = null;  
  public messages$: Observable<any[] | null>;
  public hasMore$: Observable<boolean>;
  public chatForm: FormGroup;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private classchatService: ClasschatService,
    private fb: FormBuilder
  )
    {
      this.messages$ = this.classchatService.messages$;
      this.hasMore$ = this.classchatService.hasMore$;
      this.chatForm = this.fb.group({
      message: ['', []]
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
  public loadMoreMessages(): void {
    this.classchatService.loadMoreMessages();
  }
  public loadNewMessages(): void {
    this.classchatService.loadNewMessages();
  }
}