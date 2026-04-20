import { chatApi, courseApi, enrollmentApi, ingestionApi, progressApi } from '../../../services/api';

export const studentWorkspaceApi = {
  listChatSessions: chatApi.listSessions,
  getChatSessionDetail: chatApi.getSessionDetail,
  queryChatAtomic: chatApi.queryAtomic,
  sendChatMessage: chatApi.sendMessage,
  deleteChatSession: chatApi.deleteSession,
  archiveChatSession: chatApi.archiveSession,
  uploadReference: ingestionApi.uploadDocument,
  listEnrollments: enrollmentApi.list,
  searchOfferings: enrollmentApi.searchOfferings,
  enrollByKey: enrollmentApi.enrollByKey,
  enrollInOffering: enrollmentApi.enroll,
  getCourse: courseApi.get,
  getRoadmap: progressApi.getRoadmap,
  getProgressSummary: progressApi.getProgressSummary,
  getGamification: progressApi.getGamification,
  getLeaderboard: progressApi.getLeaderboard,
  startRoadmapItem: progressApi.startItem,
  createAttempt: progressApi.createAttempt,
  submitAttempt: progressApi.submitAttempt,
};
