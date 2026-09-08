import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateBusinessCandidates,type DomainProposalMaterial,type BusinessDomainCandidate} from '../../../../shared/domain-proposals.ts';
test('PF-BD-5 proposed domains require actual source/core references and unique unregistered names',()=>{
  const material:DomainProposalMaterial={registered:[{id:'core',name:'Play',kind:'core',value:'Play games',description:null,anatomiaDomain:'Gameplay'}],unregistered:[],sources:[{ref:'fragment:f',content:'Buy items'}],includesAnatomia:false};
  const candidate:BusinessDomainCandidate={name:'Shop',responsibility:'Buy items',value:'Choose items',sourceRefs:['fragment:f'],coreComparisons:[{coreId:'core',relationship:'Supplies game items',difference:'Purchases are separate from play'}]};
  assert.equal(validateBusinessCandidates(material,[candidate]),true);
  assert.equal(validateBusinessCandidates(material,[candidate,candidate]),false);
  assert.equal(validateBusinessCandidates(material,[{...candidate,name:' ＰＬＡＹ '}]),false);
  assert.equal(validateBusinessCandidates(material,[{...candidate,name:'Gameplay'}]),false);
  assert.equal(validateBusinessCandidates(material,[{...candidate,sourceRefs:['fragment:missing']}]),false);
  assert.equal(validateBusinessCandidates(material,[{...candidate,coreComparisons:[{...candidate.coreComparisons[0]!,coreId:'missing'}]}]),false);
});
