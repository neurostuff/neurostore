import Vue from 'vue';
import Router from 'vue-router';
import Study from '@/components/data/Study';
import StudyList from '@/components/data/StudyList';
import ImageList from '@/components/data/ImageList';
import AnalysisWizard from '@/components/analysis/AnalysisWizard';
// import Image from '@/components/Image';

Vue.use(Router);

export default new Router({
  routes: [
    {
      path: '/studies/:id',
      name: 'Study viewer',
      component: Study,
    }, {
      path: '/studies/',
      name: 'Study list',
      component: StudyList,
    }, {
      path: '/analysis/new',
      name: 'Analysis Builder',
      component: AnalysisWizard,
    }, {
      path: '/images/',
      name: 'Image list',
      component: ImageList,
    }
    // {
    //   path: '/images/:id',
    //   name: 'Image viewer',
    //   component: Image,
    // },
    
  ],
  mode: 'history',
});
