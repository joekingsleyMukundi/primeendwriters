// jshint esversion:9
const Job = require("../models/jobs");
const User = require("../models/writter");
const { sendMail } = require('../utils/sendemail.js');
exports.adminDashboard = async (req,res,next)=>{
  const user=req.session.user;
  if(user.role != "admin"){
    return res.redirect('/');
  }
  var totaljobs;
  var pendingjobs;
  var pendingpayment = 0;
  var completedpayments = 0;
  const unverifiedWriters = await User.find({role:"writer",verified:false});
  const jobs = await Job.find();
  const writers = await User.find({role:"writer"});
  if (jobs.length == 0){
    totaljobs = 0;
    pendingjobs = 0;
  }else{
    totaljobs = jobs.length;
    pendingjobsarray = await Job.find({status:'pending payment'});
    completedarry = await Job.find({status:'paid'});
    completedarry.forEach(completedJob => {
      completedpayments += completedJob.amount;
    });
    pendingjobsarray.forEach(pendingjob => {
      pendingpayment += pendingjob.amount;
    });
    pendingjobs=pendingjobsarray.length;
  }
  context = {
    user:user,
    writers:writers,
    totalWriters:writers.length,
    unverified:unverifiedWriters.length,
    pendingjobs:pendingjobs,
    totaljobs:totaljobs,
    jobs:jobs,
    completedpayments:completedpayments,
    pendingpayment:pendingpayment,
    errormessage:req.flash('error'),
    successmessage:req.flash('success')
  };
  res.render('admindashboard',context);
};

exports.writters = async (req,res,next)=>{
  const user=req.session.user;
  if(user.role != "admin"){
    return res.redirect('/');
  }
  const writers = await User.find({role:"writer"});
  context = {
    user:user,
    writters:writers,
    errormessage:req.flash('error'),
    successmessage:req.flash('success')
  };
  res.render('adminusers',context);
};

exports.activateAccount=async(req,res,next)=>{
  const id = req.params.id;
  const writer = await User.findById(id);
  writer.verified = true;
  await writer.save();
  const message  = `Dear partner am happy to inform you that you have been approved  you can now access the dashboard`;
  const subj = "User approved";
  sendMail(writer.username,writer.email,subj,message);
  res.redirect('/admindashboard');
};

exports.jobs =async(req,res,next)=>{
  const user=req.session.user;
  if(user.role != "admin"){
    return res.redirect('/');
  }
  const id = req.params.id;
  const jobs  = await Job.find({writerid:id});
  const writer =  await User.findById(id)
  const completedjobs = await Job.find({writerid:id,status:'paid'});
  const pendingjobs = await Job.find({writerid:id,status:'pending payment'});
  const rejectedJobs =  await Job.find({writerid:id,status:'rejected'});
  context = {
    user:user,
    jobs:jobs,
    writer:writer,
    completedjobs,completedjobs,
    pendingjobs:pendingjobs,
    rejectedJobs:rejectedJobs,
    errormessage:req.flash('error'),
    successmessage:req.flash('success')
  };
  res.render('adminwriters.ejs', context);
};
exports.pay=async(req,res,next)=>{
  const id = req.params.id;
  const job = await Job.findById(id);
  job.verified = true;
  job.status = "paid";
  job.save();
  User.findOne({email:job.writeremail})
  .then(user=>{
    const prev = user.pendingRevenue;
    const newprev = prev-job.amount;
    user.pendingRevenue = newprev;
    const rev = user.totalRevenue;
    const newrev = rev+job.amount;
    user.totalRevenue = newrev;
    user.save();
    req.flash('success', 'Successfully approved and confirmed payment for the job');
    const message  = `Dear partner you have successfully recived payment for job title ${job.jobTitle}`;
    const subj = "Payment Confirmation";
    sendMail(user.username,user.email,subj,message);
    return res.redirect(`/jobs/${job.writerid}`);
  })
  .catch(error=>{
    console.log(error);
    req.flash('error', 'an erroroccored');
    return res.redirect('/admindashboard');
  });
};
exports.approveJob=async(req,res,next)=>{
  const id = req.params.id;
  const job = await Job.findById(id);
  job.verified = true;
  job.status = "pending payment";
  job.save();
  User.findOne({email:job.writeremail})
  .then(user=>{
    const prev = user.pendingRevenue;
    const newprev = prev+job.amount;
    user.pendingRevenue = newprev;
    user.save();
    const message  = `Dear partner your job 'with' title ${job.jobTitle} has successfully been approver and payment will be sent soon`;
    const subj = "Job Approval";
    sendMail(user.username,user.email,subj,message);
    req.flash('success', 'Successfully approved and confirmed payment for the job');
    return res.redirect(`/jobs/${job.writerid}`);
  })
  .catch(error=>{
    console.log(error);
    req.flash('error', 'an erroroccored');
    return res.redirect('/admindashboard');
  });
};

exports.revertjob=async(req,res,next)=>{
  const id = req.params.id;
  const job = await Job.findById(id);
  job.verified = false;
  job.status = "pending";
  job.save();
  User.findOne({email:job.writeremail})
  .then(user=>{
    const prev = user.pendingRevenue;
    const newprev = prev-job.amount;
    user.pendingRevenue = newprev;
    user.save();
    req.flash('success', 'Successfully approved and confirmed payment for the job');
    const message  = `Dear partner your job 'with' title ${job.jobTitle} has  been reverted`;
    const subj = "Job Reverted";
    sendMail(user.username,user.email,subj,message);
    return res.redirect(`/jobs/${job.writerid}`);
  })
  .catch(error=>{
    console.log(error);
    req.flash('error', 'an erroroccored');
    return res.redirect('/admindashboard');
  });
};

exports.declineJob=async(req,res,next)=>{
  const id = req.params.id;
  const job = await Job.findById(id);
  job.status = 'rejected';
  await job.save();
  req.flash('success', 'Successfully rejected the job');
  const message  = `Dear partner your job 'with' title ${job.jobTitle} has regretfully been rejected`;
  const subj = "Job Rejected";
  sendMail(job.writerUsername,job.writeremail,subj,message);
  res.redirect(`/jobs/${job.writerid}`);
};
exports.deleteUser = async (req,res,next)=>{
  const id = req.params.id;
  const writer = await User.findById(id);
  writer.verified = false;
  writer.save()
  .then(results=>{
    console.log('success');
    req.flash('success', 'Successfully rejected the user');
    const message  = `Dear partner am sorry to inform you you have been revocked please contact the admin`;
    const subj = "Job Rejected";
    sendMail(writer.username,writer.email,subj,message);
    return res.redirect('/adminDashboard');
  })
  .catch(error=>{
    console.log(error);
    req.flash('error', 'an erroroccored');
    return res.redirect('/admindashboard');
  });
};