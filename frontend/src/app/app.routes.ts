
import { Routes } from '@angular/router';

import { AuthGuard } from '@guards/auth.guard';
import { OwnProfileRedirectGuard } from '@guards/own-profile-redirect.guard';
import { UserResolver } from '@resolvers/user.resolver';
import { ProfileResolver } from '@resolvers/profile.resolver';
import { ClassResolver } from '@resolvers/class.resolver';
import { AccountResolver } from '@resolvers/account.resolver';
import { RequestResolver } from '@resolvers/request.resolver';
import { ChatList } from '@pages/#chat/chat-list/chat-list';
import { Chat } from '@pages/#chat/chat/chat';
import { ClassChat } from '@pages/#class/class-chat/class-chat';
import { ClassInfo } from '@pages/#class/class-info/class-info';
import { ClassList } from '@pages/#class/class-list/class-list';
import { Main } from '@pages/#navigation/main/main';
import { NotExist } from '@pages/#navigation/not-exist/not-exist';
import { Account } from '@pages/#user/account/account';
import { LoginComponent } from '@pages/#user/login/login';
import { Profile } from '@pages/#user/profile/profile';
import { RegisterComponent } from '@pages/#user/register/register';
import { Request } from '@pages/#class/request/request';
import { ChatMessagesResolver } from '@resolvers/messages.resolver';
import { ClassChatResolver } from '@resolvers/classchat.resolver';
import { WeekLessons } from '@pages/week-lessons/week-lessons';
import { ClassLessons } from '@pages/#class/class-lessons/class-lessons';
import { LessonsResolver } from '@resolvers/lessons.resolver';
import { Advertisements } from '@pages/advertisements/advertisements';
import { ClassMembers } from '@pages/#class/class-members/class-members';

export const routes: Routes = [
  {
    path: '',
    resolve: { user: UserResolver },
    children: [
      {
        path: '',
        component: Main,
        title: 'Главная'
      },
      {
        path: 'chat',
        component: ChatList,
        canActivate: [AuthGuard],
        title: 'Список чатов'
      },
      {
        path: 'login',
        component: LoginComponent,
        title: 'Войти в аккаунт'
      },
      {
        path: 'advertisements',
        component: Advertisements,
        title: 'Объявления'
      },
      {
        path: 'register',
        component: RegisterComponent,
        title: 'Зарегистрироваться'
      },
      {
        path: 'account',
        component: Account,
        canActivate: [AuthGuard],
        resolve: { account: AccountResolver },
        title: 'Настройки аккаунта'
      },
      {
        path: 'profile/:username',
        component: Profile,
        canActivate: [OwnProfileRedirectGuard],
        resolve: { profile: ProfileResolver }
      },
      {
        path: 'chat/:username',
        component: Chat,
        canActivate: [AuthGuard],
        resolve: {
          profile: ProfileResolver,
          messages: ChatMessagesResolver
        }
      },
      {
        path: 'class',
        component: ClassList,
        canActivate: [AuthGuard],
        title: 'Список классов'
      },
      {
        path: 'class/:link',
        component: ClassChat,
        resolve: {
          class: ClassResolver,
          messages: ClassChatResolver
        },
        canActivate: [AuthGuard]
      },
      {
        path: 'class/:link/info',
        component: ClassInfo,
        resolve: { class: ClassResolver },
        canActivate: [AuthGuard]
      },
      {
        path: 'class/:link/lessons',
        component: ClassLessons,
        resolve: { class: ClassResolver, lessons: LessonsResolver },
        canActivate: [AuthGuard]
      },
      {
        path: 'class/:link/members',
        component: ClassMembers,
        resolve: { class: ClassResolver },
        canActivate: [AuthGuard]
      },
      {
        path: 'request/:link',
        component: Request,
        canActivate: [AuthGuard],
        resolve: { request: RequestResolver }
      },
      {
        path: 'lessons',
        component: WeekLessons,
        resolve: { lessons: LessonsResolver },
        canActivate: [AuthGuard]
      },
      {
        path: '**',
        component: NotExist,
        title: 'Ошибка 404'
      }
    ]
  }
];
