const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

// Sort users by totalProcessedImages and calculate rank + avg/day
code = code.replace(
  `      setUsers(usersData);
      setTotalSiteImages(total);
    } catch (error) {`,
  `      usersData.sort((a, b) => (b.totalProcessedImages || 0) - (a.totalProcessedImages || 0));
      setUsers(usersData);
      setTotalSiteImages(total);
    } catch (error) {`
);

// Add Rank and Avg/Day columns
code = code.replace(
  `<th className="pb-3 font-semibold w-1/4">User</th>`,
  `<th className="pb-3 font-semibold w-16">Rank</th>
                  <th className="pb-3 font-semibold w-1/4">User</th>`
);

code = code.replace(
  `<th className="pb-3 font-semibold">Processed</th>`,
  `<th className="pb-3 font-semibold">Processed</th>
                  <th className="pb-3 font-semibold">Avg/Day</th>`
);

code = code.replace(
  `<td colSpan={7} className="py-8 text-center text-slate-500">Loading users...</td>`,
  `<td colSpan={9} className="py-8 text-center text-slate-500">Loading users...</td>`
);
code = code.replace(
  `<td colSpan={7} className="py-8 text-center text-slate-500">No users found.</td>`,
  `<td colSpan={9} className="py-8 text-center text-slate-500">No users found.</td>`
);

// We need to inject rank and avg/day into map
// Let's find the map line
code = code.replace(
  `filteredUsers.map(user => (
                      <tr key={user.uid} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-4">`,
  `filteredUsers.map((user, index) => {
                        const rank = index + 1;
                        let avgPerDay = 0;
                        if (user.joinDate) {
                          const joinDate = new Date(user.joinDate);
                          const days = Math.max(1, Math.floor((Date.now() - joinDate.getTime()) / (1000 * 60 * 60 * 24)));
                          avgPerDay = Math.round((user.totalProcessedImages || 0) / days);
                        }
                        return (
                      <tr key={user.uid} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-4 font-bold text-slate-400">#{rank}</td>
                        <td className="py-4">`
);

code = code.replace(
  `<td className="py-4 font-bold text-white">{(user.totalProcessedImages || 0).toLocaleString()}</td>`,
  `<td className="py-4 font-bold text-white">{(user.totalProcessedImages || 0).toLocaleString()}</td>
                        <td className="py-4 text-emerald-400 font-medium">{avgPerDay.toLocaleString()}/d</td>`
);

fs.writeFileSync('src/pages/AdminDashboard.tsx', code);
