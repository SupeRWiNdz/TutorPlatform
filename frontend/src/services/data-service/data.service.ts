import { Injectable } from '@angular/core';
import { ClasschatDataService } from './classchat.ds';
import { ClassDataService } from './class.ds';
import { MessageDataService } from './message.ds';
import { SessionDataService } from './session.ds';
import { UserDataService } from './user.ds';

@Injectable({
  providedIn: 'root'
})
export class DataService {

  constructor(
    public classchatDS: ClasschatDataService,
    public classDS: ClassDataService,
    public messageDS: MessageDataService,
    public sessionDS: SessionDataService,
    public userDS: UserDataService
  ) {}
}