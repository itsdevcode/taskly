import { test, expect } from '@playwright/test';
test.beforeEach(async({page})=>{
  await page.addInitScript(()=>{
    Object.defineProperty(window,'isTauri',{value:true});
    const store:Record<string,unknown>[]=[];
    Object.defineProperty(window,'__TAURI_INTERNALS__',{value:{
      invoke:async(command:string,args:{id?:string;input?:Record<string,unknown>;status?:string}={})=>{
        const now=new Date().toISOString();
        if(command==='list_tasks')return structuredClone(store);
        if(command==='create_task'){const task={id:crypto.randomUUID(),...args.input,status:'pending',createdAt:now,updatedAt:now,completedAt:null};store.push(task);return structuredClone(task);}
        const index=store.findIndex(t=>t.id===args.id);
        if(index<0)throw {message:'Task not found'};
        if(command==='delete_task'){store.splice(index,1);return;}
        if(command==='update_task')Object.assign(store[index],args.input,{updatedAt:now});
        if(command==='set_task_status')Object.assign(store[index],{status:args.status,completedAt:args.status==='completed'?now:null,updatedAt:now});
        return structuredClone(store[index]);
      },
    }});
  });
  await page.goto('/');
});
test('creates, searches, edits, completes, reopens and confirms deletion',async({page})=>{
  await expect(page.getByRole('heading',{name:'A fresh start. A clearer mind.'})).toBeVisible();
  await page.screenshot({path:'artifacts/workspace-light.png'});
  await page.keyboard.press('Control+n');
  await page.getByLabel('Task title').fill('Plan the week');
  await page.getByLabel('Description').fill('Choose three priorities');
  await page.getByRole('button',{name:'Create task',exact:true}).click();
  await expect(page.getByText('Plan the week',{exact:true})).toBeVisible();
  await page.keyboard.press('Control+f');
  await expect(page.getByRole('textbox',{name:'Search tasks'})).toBeFocused();
  await page.getByRole('textbox',{name:'Search tasks'}).fill('PRIORITIES');
  await expect(page.getByText('Plan the week',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Clear search'}).click();
  await page.getByRole('button',{name:'Edit Plan the week'}).click();
  await page.getByLabel('Task title').fill('Plan a clear week');
  await page.getByRole('button',{name:'Save changes'}).click();
  await page.getByRole('button',{name:'Complete Plan a clear week',exact:true}).click();
  await page.getByRole('button',{name:/^Completed \d/}).click();
  await expect(page.getByText('Plan a clear week',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Reopen Plan a clear week',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Your wins will live here'})).toBeVisible();
  await page.getByRole('button',{name:/^Pending \d/}).click();
  await page.getByRole('button',{name:'Delete Plan a clear week'}).click();
  await page.getByRole('button',{name:'Keep task'}).click();
  await expect(page.getByText('Plan a clear week',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Delete Plan a clear week'}).click();
  await page.getByRole('button',{name:'Delete task',exact:true}).click();
  await expect(page.getByRole('heading',{name:'You’re all clear for now'})).toBeVisible();
});
test('switches themes, traps dialog focus and handles the minimum window size',async({page})=>{
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  await page.getByRole('button',{name:'dark',exact:true}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.screenshot({path:'artifacts/workspace-dark.png'});
  await page.setViewportSize({width:720,height:540});
  await page.getByRole('button',{name:'Add task',exact:false}).first().click();
  await expect(page.getByLabel('Task title')).toBeFocused();
  for(let i=0;i<10;i++)await page.keyboard.press('Tab');
  expect(await page.evaluate(()=>!!document.activeElement?.closest('dialog'))).toBe(true);
  await page.screenshot({path:'artifacts/task-form-small.png'});
  await page.keyboard.press('Escape');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
